import Member from "../Modules/NewMem.js";
import PaymentTransaction from "../Modules/PaymentTransaction.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utility/cloudinary.js";
import mongoose from "mongoose";

// Helper: Parse Duration in Days (Supporting preset strings for backward compatibility)
export const parseDurationDays = (durInput) => {
  if (durInput === undefined || durInput === null || durInput === "") {
    throw new Error("Duration must be a positive integer.");
  }
  const str = String(durInput).toLowerCase().trim();

  if (str === "1 week") return 7;
  if (str === "2 weeks") return 14;
  if (str === "1 month") return 30;
  if (str === "3 months") return 90;
  if (str === "6 months") return 180;
  if (str === "12 months" || str === "1 year") return 365;

  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error("Duration must be a positive integer.");
  }
  return Math.min(parsed, 3650); // Cap at 10 years max
};

// Expiry Date Calculator Helper (Start Date + Duration in Days)
const calculateExpiryDate = (startDateStr, durationDaysInput) => {
  let start;
  if (startDateStr) {
    // Retain exact time of day for precise 24-hour elapsed calculations
    const chosenDate = new Date(startDateStr);
    const now = new Date();
    chosenDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    start = chosenDate;
  } else {
    start = new Date();
  }

  if (isNaN(start.getTime())) throw new Error("Invalid start date provided.");

  const days = parseDurationDays(durationDaysInput);
  const exp = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return { expiryDate: exp, durationDays: days };
};

// @desc    Create New Member
// @route   POST /api/members
// @access  Private (Owner JWT)
export const createMember = async (req, res) => {
  try {
    const { name, contact, picture, startDate, duration, totalAmount, paidAmount, batch, timeSlot } = req.body;

    // 1. Input Validation
    if (!name || !contact || !startDate || !duration || totalAmount === undefined || paidAmount === undefined || !batch || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields (Name, Phone, Start Date, Duration, Batch, Time Slot, Total Fee, Paid Amount).",
      });
    }

 

    const total = Number(totalAmount);
    const paid = Number(paidAmount);

    if (isNaN(total) || isNaN(paid) || total < 0 || paid < 0) {
      return res.status(400).json({
        success: false,
        message: "Negative or invalid payment amounts are not allowed.",
      });
    }

    if (paid > total) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot exceed total membership fee.",
      });
    }

    // 2. Duration & Expiry Calculation
    let start;
    try {
      start = startDate ? new Date(startDate) : new Date();
      if (isNaN(start.getTime())) throw new Error();
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid start date provided.",
      });
    }

    const { expiryDate, durationDays } = calculateExpiryDate(start, duration);

    // 3. Cloudinary Upload
    let imageUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
    let cloudinaryPublicId = "";

    if (picture && (picture.startsWith("data:image") || picture.length > 500)) {
      const uploadRes = await uploadToCloudinary(picture, "gym_members");
      imageUrl = uploadRes.url;
      cloudinaryPublicId = uploadRes.public_id;
    } else if (picture) {
      imageUrl = picture;
    }

    // 4. Save to MongoDB
    const newMember = new Member({
      name: name.trim(),
      contact: String(contact).trim(),
      picture: imageUrl,
      cloudinaryPublicId,
      startDate: start,
      expiryDate,
      duration: durationDays,
      batch,
      timeSlot: timeSlot.trim(),
      totalAmount: total,
      paidAmount: paid,
    });

    await newMember.save();

    if (paid > 0) {
      await PaymentTransaction.create({
        memberId: newMember._id,
        amount: paid,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Member registered successfully!",
      member: newMember,
    });
  } catch (error) {
    console.error("Error creating member:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating member",
});
  }
};

// @desc    Get All Members (with search, filter, and pagination)
// @route   GET /api/members
// @access  Private (Owner JWT)
export const getAllMembers = async (req, res) => {
  try {
    const { search, filter, durationFilter, page = 1, limit = 10 } = req.query;
    let query = {};

    const now = new Date();

    // Backend-derived status filtering
    if (filter === "active") {
      query.expiryDate = { $gt: now };
    } else if (filter === "expired") {
      query.expiryDate = { $lte: now };
    } else if (filter === "paid") {
      query.paymentStatus = "PAID";
    } else if (filter === "pending") {
      query.paymentStatus = "PENDING";
    }

    if (durationFilter && durationFilter !== "all") {
      if (durationFilter === "expired93") {
        // EXACT LOGIC: Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24)) > 93
        query.$expr = {
          $gt: [
            { $floor: { $divide: [ { $subtract: [ now, "$expiryDate" ] }, 86400000 ] } },
            93
          ]
        };
        delete query.expiryDate;
      } else {
        if (filter === "expired") {
          query.expiryDate = { $gt: now, $lte: now }; // Impossible condition to force 0 results
        } else {
          query.expiryDate = { $gt: now }; // Enforce active member requirement
        }

        if (durationFilter === "1") {
          query.duration = { $gte: 28, $lte: 31 };
        } else if (durationFilter === "3") {
          query.duration = { $gte: 84, $lte: 93 };
        } else if (durationFilter === "6") {
          query.duration = { $gte: 168, $lte: 186 };
        } else if (durationFilter === "12") {
          query.duration = { $gte: 365, $lte: 366 };
        }
      }
    }

    // Case-insensitive search on name or contact
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const searchRegex = new RegExp(cleanSearch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), "i");
      query.$or = [
        { name: searchRegex },
        { contact: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Member.countDocuments(query);
    const members = await Member.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      count: members.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      members,
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching members",
    });
  }
};


// @desc    Get Single Member Details
// @route   GET /api/members/:id
// @access  Private (Owner JWT)
export const getMemberById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID format",
      });
    }

    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }
    return res.status(200).json({
      success: true,
      member,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching member details",
});
  }
};

// @desc    Update Member Details / Duration in Days / Record Payment
// @route   PUT /api/members/:id
// @access  Private (Owner JWT)
export const updateMember = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID format",
      });
    }

    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const { name, contact, picture, startDate, duration, totalAmount, paidAmount, batch, timeSlot } = req.body;

    if (totalAmount !== undefined) {
      if (isNaN(Number(totalAmount)) || Number(totalAmount) < 0) {
        return res.status(400).json({
          success: false,
          message: "Total amount must be a valid non-negative number.",
        });
      }
    }

    if (paidAmount !== undefined) {
      if (isNaN(Number(paidAmount)) || Number(paidAmount) < 0) {
        return res.status(400).json({
          success: false,
          message: "Paid amount must be a valid non-negative number.",
        });
      }
    }

    const targetTotal = totalAmount !== undefined ? Number(totalAmount) : member.totalAmount;
    const targetPaid = paidAmount !== undefined ? Number(paidAmount) : member.paidAmount;

    if (targetPaid > targetTotal) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot exceed total membership fee.",
      });
    }

    const previousPaidAmount = member.paidAmount;

    if (name) member.name = name.trim();
    
    if (contact) member.contact = String(contact).trim();

    if (batch) member.batch = batch;
    if (timeSlot) member.timeSlot = String(timeSlot).trim();

    member.totalAmount = targetTotal;
    member.paidAmount = targetPaid;

    if (startDate !== undefined || duration !== undefined) {
      const start = startDate ? new Date(startDate) : member.startDate;
      const durInput = duration !== undefined ? duration : member.duration;

      const { expiryDate, durationDays } = calculateExpiryDate(start, durInput);
      member.startDate = start;
      member.duration = durationDays;
      member.expiryDate = expiryDate;
    }

    // Image replacement & Cloudinary cleanup
    if (picture && (picture.startsWith("data:image") || picture.length > 500)) {
      const oldPublicId = member.cloudinaryPublicId;
      const uploadRes = await uploadToCloudinary(picture, "gym_members");
      member.picture = uploadRes.url;
      member.cloudinaryPublicId = uploadRes.public_id;

      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId);
      }
    } else if (picture) {
      member.picture = picture;
    }

    // Pre-save hook recalculates pendingAmount and paymentStatus
    await member.save();

    if (targetPaid > previousPaidAmount) {
      const paymentReceived = targetPaid - previousPaidAmount;
      await PaymentTransaction.create({
        memberId: member._id,
        amount: paymentReceived,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member updated successfully",
      member,
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating member",
});
  }
};

// @desc    Delete Member & Clean Up Cloudinary Image
// @route   DELETE /api/members/:id
// @access  Private (Owner JWT)
export const deleteMember = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID format",
      });
    }

    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    const publicId = member.cloudinaryPublicId;

    await Member.findByIdAndDelete(req.params.id);

    if (publicId) {
      deleteFromCloudinary(publicId);
    }

    return res.status(200).json({
      success: true,
      message: "Member deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting member:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting member",
});
  }
};

// @desc    Bulk Delete Members & Clean Up Cloudinary Images
// @route   DELETE /api/members/bulk-delete
// @access  Private (Owner JWT)
export const bulkDeleteMembers = async (req, res) => {
  try {
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No member IDs provided for deletion.",
      });
    }

    // Validate all IDs
    const validIds = memberIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member IDs provided.",
      });
    }

    // Fetch members to get their Cloudinary public IDs
    const membersToDelete = await Member.find({ _id: { $in: validIds } });
    
    if (membersToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching members found to delete.",
      });
    }

    // Extract Cloudinary public IDs for those who have an image
    const publicIds = membersToDelete
      .map((m) => m.cloudinaryPublicId)
      .filter((id) => id);

    // Delete members from MongoDB
    await Member.deleteMany({ _id: { $in: validIds } });

    // Clean up Cloudinary images sequentially (or could be Promise.all, but sequential is safer for rate limits)
    for (const publicId of publicIds) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (cloudErr) {
        console.error(`Failed to delete image ${publicId} from Cloudinary`, cloudErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${validIds.length} members.`,
      deletedCount: validIds.length,
      deletedIds: validIds
    });
  } catch (error) {
    console.error("Error bulk deleting members:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during bulk deletion.",
    });
  }
};
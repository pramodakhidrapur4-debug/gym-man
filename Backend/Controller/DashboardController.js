import Member from "../Modules/NewMem.js";

// @desc    Get Real-time MongoDB Dashboard Statistics & Revenue Summary
// @route   GET /api/dashboard
// @access  Private (Owner JWT)
export const getDashboardData = async (req, res) => {
  try {
    const now = new Date();

    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ expiryDate: { $gte: now } });
    const expiredMembers = await Member.countDocuments({ expiryDate: { $lt: now } });
    const fullyPaidMembers = await Member.countDocuments({ pendingAmount: 0 });
    const pendingMembers = await Member.countDocuments({ pendingAmount: { $gt: 0 } });

    // Financial aggregation query from MongoDB
    const financialStats = await Member.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$paidAmount" },
          pendingRevenue: { $sum: "$pendingAmount" },
          totalRevenueTarget: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = financialStats.length > 0 ? financialStats[0].totalRevenue : 0;
    const pendingRevenue = financialStats.length > 0 ? financialStats[0].pendingRevenue : 0;
    const totalRevenueTarget = financialStats.length > 0 ? financialStats[0].totalRevenueTarget : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalMembers,
        activeMembers,
        expiredMembers,
        fullyPaidMembers,
        pendingMembers,
        totalRevenue,
        pendingRevenue,
        totalRevenueTarget,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard statistics from MongoDB",
      error: error.message,
    });
  }
};

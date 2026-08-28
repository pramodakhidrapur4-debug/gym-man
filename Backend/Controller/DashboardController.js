import Member from "../Modules/NewMem.js";
import PaymentTransaction from "../Modules/PaymentTransaction.js";

// @desc    Get Real-time MongoDB Dashboard Statistics & Revenue Summary
// @route   GET /api/dashboard
// @access  Private (Owner JWT)
export const getDashboardData = async (req, res) => {
  try {
    const now = new Date();

    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ expiryDate: { $gt: now } });
    const expiredMembers = await Member.countDocuments({ expiryDate: { $lte: now } });
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

    // Calculate IST midnight boundaries for Today's Income
    const utcNow = new Date();
    // IST is UTC + 5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(utcNow.getTime() + istOffset);
    
    // Start of IST today
    const startOfTodayIST = new Date(istNow);
    startOfTodayIST.setUTCHours(0, 0, 0, 0);
    const startOfTodayUTC = new Date(startOfTodayIST.getTime() - istOffset);
    
    // End of IST today
    const endOfTodayUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);

    const todayIncomeStats = await PaymentTransaction.aggregate([
      {
        $match: {
          date: { $gte: startOfTodayUTC, $lt: endOfTodayUTC }
        }
      },
      {
        $group: {
          _id: null,
          todayIncome: { $sum: "$amount" }
        }
      }
    ]);
    const todayIncome = todayIncomeStats.length > 0 ? todayIncomeStats[0].todayIncome : 0;

    // Calculate active members by duration
    const durationStats = {
      "1": await Member.countDocuments({ expiryDate: { $gt: now }, duration: { $gte: 28, $lte: 31 } }),
      "3": await Member.countDocuments({ expiryDate: { $gt: now }, duration: { $gte: 84, $lte: 93 } }),
      "6": await Member.countDocuments({ expiryDate: { $gt: now }, duration: { $gte: 168, $lte: 186 } }),
      "12": await Member.countDocuments({ expiryDate: { $gt: now }, duration: { $gte: 365, $lte: 366 } }),
      "expired93": await Member.countDocuments({
        $expr: {
          $gt: [
            { $floor: { $divide: [ { $subtract: [ now, "$expiryDate" ] }, 86400000 ] } },
            93
          ]
        }
      })
    };

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
        todayIncome,
        durationStats,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while calculating dashboard statistics.",
    });
  }
};

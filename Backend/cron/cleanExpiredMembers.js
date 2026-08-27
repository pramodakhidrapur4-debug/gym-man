import cron from 'node-cron';
import Member from '../Modules/NewMem.js';
import { deleteFromCloudinary } from '../utility/cloudinary.js';

const startCleanupCron = () => {
  // Run every day at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled task: Cleanup expired members (> 93 days)');
    try {
      const currentDate = new Date();
      // Calculate the exact cutoff date: 93 days ago
      const cutoffDate = new Date(currentDate.getTime() - (93 * 24 * 60 * 60 * 1000));

      // Find members whose expiryDate is strictly less than cutoffDate
      // (meaning they have been expired for more than 93 days)
      const expiredMembers = await Member.find({
        expiryDate: { $exists: true, $type: 'date', $lt: cutoffDate }
      });

      if (!expiredMembers || expiredMembers.length === 0) {
        console.log('No members found for deletion.');
        return;
      }

      console.log(`Found ${expiredMembers.length} member(s) to permanently delete.`);

      for (const member of expiredMembers) {
        // 1. Delete associated image from Cloudinary if public ID exists
        if (member.cloudinaryPublicId) {
          try {
            await deleteFromCloudinary(member.cloudinaryPublicId);
          } catch (cloudErr) {
            console.error(`Warning: Failed to delete Cloudinary image for member ${member._id}:`, cloudErr.message);
            // We still proceed to delete the member from DB
          }
        }

        // 2. Delete member from DB
        await Member.findByIdAndDelete(member._id);
        console.log(`Successfully deleted member: ${member.name} (${member._id})`);
      }

      console.log('Cleanup task completed successfully.');
    } catch (error) {
      console.error('Error during expired members cleanup task:', error);
    }
  });

  console.log('Cron job for expired members cleanup initialized.');
};

export default startCleanupCron;

const { Job } = require("../model/job.model");

class JobService {
  //Create new job
  async createJob(job) {
    return await job.save();
  }

  async getJobById(jobId) {
    return await Job.findById(jobId);
  }

  async validateJobIds(jobIds) {
    const jobs = await Job.find({
      _id: { $in: jobIds },
    });

    const foundIds = jobs.map((d) => d._id.toString());

    const missingIds = jobIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getJobByEntryIdAndStaffId(entryId, staffId) {
    return await Job.findOne({ entryId, staffId });
  }

  async getAllJobs() {
    return await Job.find().sort({ _id: -1 });
  }

  async updateJobById(id, job) {
    return await Job.findByIdAndUpdate(
      id,
      {
        $set: job,
      },
      { new: true }
    );
  }

  async deleteJob(id) {
    return await Job.findByIdAndRemove(id);
  }
}

module.exports = new JobService();

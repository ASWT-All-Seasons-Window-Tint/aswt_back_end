const { Job } = require("../model/job.model");
const jobService = require("../services/job.services");
const userService = require("../services/user.services");
const serviceService = require("../services/service.services");
const entryService = require("../services/entry.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class JobController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new job
  async createJob(req, res) {
    const { staffId, entryId, serviceId } = req.body;

    const [[staff], entry, service] = await Promise.all([
      userService.getUserByRoleAndId(staffId, "staff"),
      entryService.getEntryById(entryId),
      serviceService.getServiceById(serviceId),
    ]);

    if (!staff) return res.status(404).send(errorMessage("staff"));
    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));

    let job = new Job({
      staffId,
      entryId,
      serviceId,
      date: new Date(),
    });

    job = await jobService.createJob(job);

    res.send(successMessage(MESSAGES.CREATED, job));
  }

  //get job from the database, using their email
  async getJobById(req, res) {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).send(errorMessage("job"));

    res.send(successMessage(MESSAGES.FETCHED, job));
  }

  async getJobByEntryIdAndStaffId(req, res) {
    const { entryId, staffId } = req.body;

    const job = await jobService.getJobByEntryIdAndStaffId(entryId, staffId);
    if (!job) return res.status(404).send(errorMessage("job"));

    res.send(successMessage(MESSAGES.FETCHED, job));
  }

  //get all entries in the job collection/table
  async fetchAllJobs(req, res) {
    const entries = await jobService.getAllJobs();

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  //Update/edit job data
  async updateJob(req, res) {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).send(errorMessage("job"));

    let updatedJob = req.body;
    updatedJob = await jobService.updateJobById(req.params.id, updatedJob);

    res.send(successMessage(MESSAGES.UPDATED, updatedJob));
  }

  //Delete job account entirely from the database
  async deleteJob(req, res) {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).send(errorMessage("job"));

    await jobService.deleteJob(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, job));
  }
}

module.exports = new JobController();

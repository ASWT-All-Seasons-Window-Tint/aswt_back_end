const { Incentive } = require("../model/incentive.model").incentive;
const { MESSAGES } = require("../common/constants.common");
const { errorMessage, successMessage } = require("../common/messages.common");
const incentiveServices = require("../services/incentive.services");

class IncentiveController {
  async createIncentive(req, res) {
    const incentive = await incentiveServices.createIncentive(req.body);

    // Sends the created incentive as response
    res.send(successMessage(MESSAGES.CREATED, incentive));
  }

  //get all incentives in the incentive collection/table
  async fetchIncentives(req, res) {
    const incentives = await incentiveServices.getAllIncentives();

    res.send(successMessage(MESSAGES.FETCHED, incentives));
  }

  //get incentive from the database, using their email
  async getIncentiveById(req, res) {
    const incentive = await incentiveServices.getIncentiveById(req.params.id);

    if (incentive) {
      res.send(successMessage(MESSAGES.FETCHED, incentive));
    } else {
      res.status(404).send(errorMessage("incentive"));
    }
  }

  //Update/edit incentive data
  async updateIncentive(req, res) {
    let incentive = await incentiveServices.getIncentiveById(req.params.id);
    if (!incentive) return res.status(404).send(errorMessage("incentive"));

    incentive = await incentiveServices.updateIncentiveById(
      req.params.id,
      req.body
    );

    res.send(successMessage(MESSAGES.UPDATED, incentive));
  }

  //Delete incentive account entirely from the database
  async deleteIncentive(req, res) {
    let incentive = await incentiveServices.getIncentiveById(req.params.id);

    if (!incentive) return res.status(404).send(errorMessage("incentive"));

    await incentiveServices.deleteIncentive(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, incentive));
  }
}

module.exports = new IncentiveController();

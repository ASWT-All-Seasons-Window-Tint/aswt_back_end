require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const ticketService = require("../services/ticket.services");
const userService = require("../services/user.services");
const { MESSAGES } = require("../common/constants.common");
const {
  successMessage,
  errorMessage,
  notFoundResponse,
} = require("../common/messages.common");
const streamifier = require("streamifier");

const { cloud_name, api_key, api_secret } = JSON.parse(
  process.env.cloudinaryConfig
);
// Configure Cloudinary credentials
cloudinary.config({
  cloud_name,
  api_key,
  api_secret,
});

class CertificationController {
  async addTicket(req, res) {
    try {
      const { _id: customerId } = req.user;
      const { subject, message } = req.body;

      const ticketBody = {
        customerId,
        subject,
        message,
      };

      if (req.file) {
        const fileBuffer = req.file.buffer;

        const cld_upload_stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            folder: "foo",
          },

          async function (error, result) {
            if (error) {
              console.error("Error uploading ticket:", error);
              res.status(500).json({ error: "Internal Server Error" });
            } else {
              const imageURL = result.secure_url;

              ticketBody.imageURL = imageURL;

              const ticket = await ticketService.createTicket(ticketBody);
              res.send(successMessage(MESSAGES.CREATED, ticket));
            }
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(cld_upload_stream);
      } else {
        const ticket = await ticketService.createTicket(ticketBody);

        res.send(successMessage(MESSAGES.CREATED, ticket));
      }
    } catch (error) {
      console.error("Error uploading ticket:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
  async getAllTickets(req, res) {
    const tickets = await ticketService.getAllTickets();

    res.send(successMessage(MESSAGES.FETCHED, tickets));
  }

  async getTicketByCustomerId(req, res) {
    const tickets = await ticketService.getTicketsByCustomerId(req.params.id);

    res.send(successMessage(MESSAGES.FETCHED, tickets));
  }

  async getTicketById(req, res) {
    const ticket = await ticketService.getTicketById(req.params.id);

    if (ticket) {
      res.send(successMessage(MESSAGES.FETCHED, ticket));
    } else {
      res.status(404).send(errorMessage("ticket"));
    }
  }

  async deleteTicket(req, res) {
    const { id: ticketId } = req.params;

    const ticket = await ticketService.getTicketById(ticketId);

    if (!ticket) return res.status(404).send(errorMessage("ticket"));

    await ticketService.deleteTicket(ticketId);

    res.send(successMessage(MESSAGES.DELETED, ticket));
  }

  async updateTicketById(req, res) {
    const { id: ticketId } = req.params;

    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket)
      return notFoundResponse(res, "We can't find Ticket with the given ID");

    req.body.responseTime = new Date();

    const updatedTicket = await ticketService.updateTicketById(
      ticketId,
      req.body
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedTicket));
  }
}
module.exports = new CertificationController();

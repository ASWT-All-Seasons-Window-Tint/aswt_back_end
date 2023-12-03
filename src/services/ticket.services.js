const { Ticket } = require("../model/ticket.model").ticket;

class TicketService {
  //Create new ticket
  async createTicket(ticketBody) {
    const { subject, message, imageURL, customerId } = ticketBody;

    const ticket = new Ticket({
      subject,
      message,
      imageURL,
      customerId,
    });

    return ticket.save();
  }

  getAllTickets() {
    return Ticket.find()
      .populate("customerId", "_id firstName lastName email")
      .sort({ _id: -1 });
  }

  getTicketById(id) {
    return Ticket.findById(id).sort({ _id: -1 });
  }

  getTicketsByCustomerId(customerId) {
    return Ticket.find({ customerId }).sort({ _id: -1 });
  }

  async updateTicketById(id, ticket) {
    return await Ticket.findByIdAndUpdate(
      id,
      {
        $set: ticket,
      },
      { new: true }
    );
  }

  async deleteTicket(id) {
    return await Ticket.findByIdAndRemove(id);
  }
}

module.exports = new TicketService();

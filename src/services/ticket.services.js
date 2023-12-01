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
      .populate("eligibleStaffs", "firstName lastName email")
      .sort({ _id: -1 });
  }

  getTicketById(id) {
    return Ticket.findById(id)
      .populate("eligibleStaffs", "firstName lastName email")
      .sort({ _id: -1 });
  }

  isTicketOngoing = (startDate, endDate) => {
    startDate = new Date(startDate);
    endDate = new Date(endDate);

    return Ticket.findOne({
      $or: [{ endTime: { $gte: startDate } }, { startTime: { $lt: endDate } }],
    });
  };

  isTicketActive = async () => {
    const currentDate = new Date();
    const activeTicket = await Ticket.findOne({
      startTime: { $lte: currentDate },
      endTime: { $gte: currentDate },
    });

    return activeTicket;
  };

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

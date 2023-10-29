const { Appointment } = require("../model/appointment.model");
const entryUtils = require("../utils/entry.utils");
const entryService = require("../services/entry.services");
const newDateUtils = require("../utils/newDate.utils");
const serviceServices = require("./service.services");
const priceListServices = require("./priceList.services");
const categoryService = require("./category.services");
const convertToLowerCaseAndRemoveNonAlphanumeric = require("../utils/convertToLowerCaseAndRemoveNonAlphanumeric.utils");

class AppointmentService {
  //Create new appointment
  async createAppointment({ body, staffId }) {
    let { startTime, endTime } = body;

    startTime = new Date(startTime);
    endTime = new Date(endTime);

    const appointment = new Appointment({
      staffId,
      ...body,
    });

    return await appointment.save();
  }

  calculateEndTime(startTime, hours) {
    // Create a copy of the start date to avoid modifying the original date
    const endTime = new Date(startTime);

    // Calculate the total milliseconds to add (including fractional part)
    const millisecondsToAdd = Math.floor(hours * 60 * 60 * 1000);

    // Add the milliseconds to the date
    endTime.setTime(endTime.getTime() + millisecondsToAdd);

    // Return the updated date
    return endTime;
  }

  async fetchAllAppointments() {
    return Appointment.find();
  }

  calculateTotalTimeOfCompletion(services) {
    // Using the reduce function to sum up all timeOfCompletion values
    const totalTime = services.reduce(
      (total, slot) => total + slot.timeOfCompletion,
      0
    );

    return totalTime;
  }

  async getAppointmentById(appointmentId) {
    return await Appointment.findById(appointmentId);
  }

  async getAppointmentByDate({ date }) {
    const { endDate, startDate } = entryUtils.getDateRange({
      type: "day",
      date,
    });
    return Appointment.find({
      startTime: { $gte: startDate, $lt: endDate },
    });
  }

  getOverlappingAppointments = async ({ staffIds, startTime, endTime }) => {
    endTime = new Date(endTime);
    startTime = new Date(startTime);

    const overlappingAppointments = await Appointment.find({
      staffId: { $in: staffIds },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    return overlappingAppointments;
  };

  getAllAppointments({ overlappingAppointments }) {
    const allAppointments = overlappingAppointments.reduce(
      (acc, appointment) => {
        acc.push({ time: appointment.startTime, isStart: true });
        acc.push({ time: appointment.endTime, isStart: false });
        return acc;
      },
      []
    );

    return allAppointments.sort((a, b) => a.time - b.time);
  }

  getAvailableTimeSlots({ allAppointments, startTime, endTime }) {
    const availableTimeSlots = [];
    let isInsideAppointment = false;
    let currentSlotStart = startTime;

    for (const event of allAppointments) {
      if (event.isStart) {
        if (!isInsideAppointment) {
          // Start of a new appointment, add available time slot
          availableTimeSlots.push({
            startTime: currentSlotStart,
            endTime: event.time,
          });
        }
        // Update currentSlotStart for the next available time slot
        currentSlotStart = event.time;
        isInsideAppointment = true;
      } else {
        // End of the current appointment, update isInsideAppointment flag
        isInsideAppointment = false;
      }
    }

    // If there's a remaining free slot at the end of the day, add it
    if (currentSlotStart < endTime && !isInsideAppointment) {
      availableTimeSlots.push({
        startTime: currentSlotStart,
        endTime,
      });
    }

    return availableTimeSlots;
  }

  getPriceForService = (services, category) => {
    const lowerCaseCategory = category.toLowerCase();

    const defaultPrices = services.map((service) => ({
      dealership: false,
      serviceName: service.name,
      price: service.defaultPrices.find((p) => p.category === lowerCaseCategory)
        .price,
      serviceType: service.type,
      serviceId: service._id,
    }));

    const priceBreakdown = [...defaultPrices];

    const price = entryService.calculateServicePriceDoneforCar(priceBreakdown);

    return { price, priceBreakdown, lowerCaseCategory };
  };

  getServiceIdsAndfilmQualityIds(serviceDetails) {
    const filmQualityIds = [];
    const serviceIds = [];

    for (const serviceDetail of serviceDetails) {
      if (serviceDetail.filmQualityId) {
        const filmQualityId = serviceDetail.filmQualityId;

        filmQualityIds.push(filmQualityId);
      }

      serviceIds.push(serviceDetail.serviceId);
    }

    return { filmQualityIds, serviceIds };
  }

  async getPriceBreakdown({ serviceDetails, categoryName, commercial }) {
    const results = {};

    results.error = {};
    results.priceBreakdownArray = [];

    for (const serviceDetail of serviceDetails) {
      const { filmQualityId, serviceId } = serviceDetail;

      const categoryNameWithoutSpecialCharacters =
        convertToLowerCaseAndRemoveNonAlphanumeric(categoryName);

      const [service, category] = await Promise.all([
        serviceServices.getServiceById(serviceId),
        categoryService.getCategoryByName(categoryNameWithoutSpecialCharacters),
      ]);

      const serviceType = service.type;

      if (!category) {
        results.error.message = "Can't find car category";
        return results;
      }
      const categoryId = category._id;

      if (serviceType === "installation" && !filmQualityId) {
        results.error.message =
          "Film quality is required for installation services";
        return results;
      }

      if (serviceType === "installation") {
        const priceBreakdown = {};

        const priceList = service.isFull
          ? await priceListServices.getPriceListByFilmQualityIdIdAndServiceId(
              serviceId,
              filmQualityId,
              categoryId
            )
          : await priceListServices.getPriceListByFilmQualityIdIdAndServiceId(
              serviceId,
              filmQualityId
            );

        if (!priceList) {
          results.error.message =
            "Can't find price list for the service and film quality";
          return results;
        }

        priceBreakdown.serviceId = priceList.serviceId.id;
        priceBreakdown.serviceName = priceList.serviceId.name;
        priceBreakdown.price = priceList.price;
        priceBreakdown.filmQuality = priceList.filmQualityId.name;
        priceBreakdown.serviceType = priceList.serviceId.type;

        results.priceBreakdownArray.push(priceBreakdown);
      }
      if (serviceType === "removal") {
        const priceBreakdown = {};

        console.log(serviceId, categoryId);

        const priceList = !service.isFull
          ? await priceListServices.getPriceListByServiceId(serviceId)
          : await priceListServices.getPriceListByFilmQualityIdIdAndServiceId(
              serviceId,
              undefined,
              categoryId
            );

        if (!priceList) {
          results.error.message = "Can't find price list for the service";
          return results;
        }

        priceBreakdown.serviceId = priceList.serviceId.id;
        priceBreakdown.serviceName = priceList.serviceId.name;
        priceBreakdown.price = priceList.price;
        priceBreakdown.serviceType = priceList.serviceId.type;

        results.priceBreakdownArray.push(priceBreakdown);
      }
      results.price = entryService.calculateServicePriceDoneforCar(
        results.priceBreakdownArray
      );
    }
    return results;
  }

  async validateAppointmentIds(appointmentIds) {
    const appointments = await Appointment.find({
      _id: { $in: appointmentIds },
    });

    const foundIds = appointments.map((d) => d._id.toString());

    const missingIds = appointmentIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getAppointmentByEntryIdAndStaffId(entryId, staffId) {
    return await Appointment.findOne({ entryId, staffId });
  }

  // async getAllAppointments() {
  //   return await Appointment.find().sort({ _id: -1 });
  // }

  async updateAppointmentById(id, appointment) {
    return await Appointment.findByIdAndUpdate(
      id,
      {
        $set: appointment,
      },
      { new: true }
    );
  }
  updateAppointmentPaymentDetails = async ({
    appointmentId,
    currency,
    paymentDate,
    amount,
    paymentIntentId,
    chargeId,
  }) => {
    const appointment = await this.getAppointmentById(appointmentId);

    if (!appointment) return;
    if (!appointment.paymentDetails) appointment.paymentDetails = {};

    appointment.paymentDetails.paymentDate = paymentDate;
    appointment.paymentDetails.currency = currency;

    const totalAmountPaid = appointment.paymentDetails.amountPaid + amount;
    appointment.paymentDetails.amountPaid = totalAmountPaid;

    const amountDue = appointment.carDetails.price - totalAmountPaid;
    appointment.paymentDetails.amountDue = amountDue;
    appointment.paymentDetails.paymentIntentId = paymentIntentId;
    appointment.paymentDetails.chargeId = chargeId;
    appointment.paymentDetails.hasPaid = true;

    return await this.updateAppointmentById(appointmentId, appointment);
  };

  refundPaymentDetails = async ({ appointment, refund }) => {
    if (!appointment.refundDetails) appointment.refundDetails = {};

    const refundAmountInCents = refund.amount;
    const refundAmount = refundAmountInCents / 100;
    const refundId = refund.id;
    const paymentIntentId = refund.payment_intent;

    appointment.refundDetails.refundDate = newDateUtils();
    appointment.refundDetails.refundAmount = refundAmount;
    appointment.refundDetails.refundId = refundId;
    appointment.refundDetails.paymentIntentId = paymentIntentId;
    appointment.refundDetails.refunded = true;
    // appointment.refundDetails.refundAmount =

    return await appointment.save();
  };

  async deleteAppointment(id) {
    return await Appointment.findByIdAndRemove(id);
  }
}

module.exports = new AppointmentService();

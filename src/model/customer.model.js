const Joi = require("joi");

function validate(customer) {
  const schema = Joi.object({
    DisplayName: Joi.string().required(),
    PrimaryEmailAddr: Joi.object({
      Address: Joi.string().email().required(),
    }).required(),
    PrimaryPhone: Joi.object({
      FreeFormNumber: Joi.string()
        .pattern(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/)
        .required(),
    }).required(),
    BillAddr: Joi.object({
      Line1: Joi.string().required(),
      City: Joi.string().required(),
      Country: Joi.string().required(),
      PostalCode: Joi.string().required(),
    }).required(),
    Notes: Joi.string(),
  });

  return schema.validate(customer);
}

exports.validate = validate;

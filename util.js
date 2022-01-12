const { PgormError } = require('./errors');

const typeErrors = {
  string: 'Must be a string',
  number: 'Must be a number',
  function: 'Must be a function',
  object: 'Must be a object',
  boolean: 'Must be a boolean',
  array: 'Must be a array',
};

module.exports.getTimestamp = () =>
  new Date().toISOString().slice(0, 19).replace('T', ' ');

module.exports.isArray = (param) => {
  if (typeof param === 'object' && param.length) return true;
  return false;
};

module.exports.verifyParamType = (paramVal, type, paramName, methodName) => {
  if (typeof paramVal !== type)
    throw new PgormError(`'${paramName}' ${typeErrors[type]}`, methodName);
};

// module.exports.verifyParams = (paramsObj, methodName) => {
//   if (paramsObj.length) {
//     // array is provided
//     for ([key, value] of Object.entries(paramsObj)) {
//     }
//   } else {
//   }
// };

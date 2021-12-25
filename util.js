module.exports.catchAsync = (fn) => (...args) => {
    try {
      fn(...args)
    } catch (err) {
      console.log(err.message);
      console.log(err)
    }
  }


module.exports.getTimestamp = () =>
  new Date().toISOString().slice(0, 19).replace("T", " ");
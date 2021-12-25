module.exports.PgormError = class extends Error{
  constructor(message, thrownAt){
    super(message);
    this.name = this.contructor.name;
    this.stack = Error.captureStackTrace(this,this.contructor);
    this.thrownAt = thrownAt;
  }
}
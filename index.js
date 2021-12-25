const { PgormError } = require("./errors");
const { getTimestamp } = require("./util");


class Model {

  // private fields
  #selectQuery;
  #updateCols;
  #columnsPlaceholders;
  #columnsLen;
  #pkName;
  #validateBeforeCreate;
  #validateBeforeUpdate;
  #validateBeforeDestroy;
  static #CLIENT;

  // private methods
  #arrangeByColumns(valuesObj) {
    const arr = [];
    for (const key in this.columns) {
      if (Object.hasOwnProperty.call(this.columns, key)) {
        const element = valuesObj[key] || null;
        arr.push(element);
      }
    }
    return arr; // arrange values acc to columns
  }

  constructor(tableName) {
    this.tableName = tableName;
    this.#pkName = 'id';
    this.tableSchema = 'public';
    this.isTableCreated = false;
    this.customQueries = {};
  }

  static useConnection(dbConnection) {
    Model.#CLIENT = dbConnection;
  }

  define(columns = {}, options = {}) {
    const columnValues = Object.keys(columns),
      timestampsSchema = Object.values(this.timestamps).map((col) => `${col} TIMESTAMP`).join(),
      tableColumnsSchema = [];

    this.columns = columns;
    this.#selectQuery = `SELECT 
      ${this.#pkName},
      ${columnValues.join()},
      ${Object.values(this.timestamps).join()} 
    FROM ${this.tableName}`;

    this.#updateCols = columnValues.map((col, index) => `${col}=$${index + 1}`).join(',');

    this.#columnsPlaceholders = columnValues.map((_, i) => '$' + (i + 1)).join();
    this.#columnsLen = columnValues.length;

    // loop through columns get the name of every column
    for (const [key, value] of Object.entries(columns)) {
      const colName = key;
      tableColumnsSchema.push(value.schema);
    }
    // create table if it doesnt exists
    Model.#CLIENT.query(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
    ${this.#pkName} SERIAL NOT NULL PRIMARY KEY,
    ${tableColumnsSchema.join()},
    ${timestampsSchema}
    )`)
      .then(() => {
        this.isTableCreated = true;

        // get all columns in the table
        return Model.#CLIENT.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='${this.tableSchema}' AND table_name='${this.tableName}'`);

      })
      .then(({ rows }) => {
        const tableColumnsNames = rows.map((col) => col.column_name);
        // check if any column is missing in the table
        const missingColumns = Object.keys(this.columns).filter((col) => !tableColumnsNames.includes(col));

        console.log('missing columns are', missingColumns);

        // if any column is missing in the table
        if (missingColumns.length) {
          // add missing columns
          const missingColumnsSchema = missingColumns.map((col) => `ADD COLUMN ${this.columns[col].schema}`).join();
          Model.#CLIENT.query(`ALTER TABLE ${this.tableName} 
          ${missingColumnsSchema}`);
        }
      })
      .catch((err) => {
        console.log(err)
        throw new Error(err.message);
      });


  }
  // validator function (colValue, colName, inputObj)
  validate(values = {}) {
    // loop through all columns of this model
    for (const key in this.columns) {
      // run all validator functions against user input
      this.columns[key]?.validations?.forEach((fn) => fn?.(values[key], key, values));
    }
  }

  // user can perform existing records validation before creating new one
  beforeCreate(fn) {
    if (typeof fn !== 'function') throw new Error('beforeCreate must be a function');
    this.#validateBeforeCreate = fn;
  }

  beforeUpdate(fn) {
    if (typeof fn !== 'function') throw new Error('beforeUpdate must be a function');
    this.#validateBeforeUpdate = fn;
  }

  beforeDestroy(fn) {
    if (typeof fn !== 'function') throw new Error('beforeDestroy must be a function');
    this.#validateBeforeDestroy = fn;
  }

  // to register new method in this model
  addQueryMethod(methodName, fn) {
    if (typeof fn !== 'function') throw new Error('fn must be a function');
    this.customQueries[methodName] = fn(Model.#CLIENT);
  }

  addForeignKey(fkName, parentTableName) {
    const thisMethodName = 'addForeignKey',
      contraintName = `${this.tableName}_${fkName}_fkey`;

    // check if fkName column exists
    const { rows: columns } = Model.#CLIENT.query(`SELECT EXISTS (SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema='${this.tableSchema}' AND table_name='${this.tableName}' AND column_name='${fkName}');`)
      .then(() => { })
      .catch((err) => {
        throw new PgormError(`Unable to check if column ${fkName} exists`, thisMethodName)
      });

    // check if constraint exists already
    const { rows: contraints } = Model.#CLIENT.query(`SELECT EXISTS (SELECT 1 
      FROM information_schema.table_constraints 
      WHERE table_schema='${this.tableSchema}' AND table_name='${this.tableName}' AND constraint_name='${contraintName}');`)
      .then(() => { })
      .catch((err) => {
        throw new PgormError(`Unable to verify ${fkName} contraint`, thisMethodName)
      });

    if (!columns[0].exists) {
      throw new PgormError(`column ${fkName} in addForeignKey does not exist`, thisMethodName)
    }

    // if foreign key doesnt exist already
    if (!contraints[0].exists) {
      // reference foreign key
      Model.#CLIENT.query(` ALTER TABLE ${this.tableName}
        ADD CONSTRAINT ${contraintName}
        FOREIGN KEY (${fkName})
        REFERENCES "${parentTableName}" (${this.#pkName});`)
        .then(() => { })
        .catch((err) => {
          throw new PgormError(`Unable to add ${fkName} foreign key`, thisMethodName)
        });
    }

  }

  async findAll(options) {
    const { rows } = await Model.#CLIENT.query(this.#selectQuery);
    return rows;
  }

  async findAllWhere(whereClause, paramsArray) {
    //
    const { rows } = await Model.#CLIENT.query(`${this.#selectQuery} ${whereClause}`, paramsArray);
    return rows;
  }

  async findOne(column, value) {

    // check if column is in this.columns;
    if (!this.columns[column]) throw new Error('Invalid column name');

    const { rows } = await Model.#CLIENT.query(`${this.#selectQuery} where ${column}=$1`, [value]);
    return rows[0];
  }

  async findById(id) {
    const { rows } = await Model.#CLIENT.query(`${this.#selectQuery} where ${this.#pkName}=$1`, [id]);
    return rows[0];
  }

  async updateById(id, values) {
    this.validate(values);
    await this.#validateBeforeUpdate?.(Model.#CLIENT);

    const
      len = this.#columnsLen,
      arrangedValues = this.#arrangeByColumns(values),
      updateQuery = `UPDATE ${this.tableName} 
        set ${this.#updateCols}, ${this.timestamps.updatedAt}=$${len + 1}
        where ${this.#pkName}=$${len + 2} RETURNING ${this.#pkName}`;

    const { rows } = await Model.#CLIENT.query(updateQuery, [...arrangedValues, getTimestamp(), id]);

    return rows[0];
  }

  async create(valuesObj) {

    this.validate(valuesObj); // user input validations
    await this.#validateBeforeCreate?.(Model.#CLIENT, valuesObj); //record validations

    const len = this.#columnsLen,
      arrangedValues = this.#arrangeByColumns(valuesObj),
      timestamp = getTimestamp(),
      insertQuery = `INSERT INTO ${this.tableName} (${Object.keys(this.columns).join()},${this.timestamps.updatedAt}, ${this.timestamps.createdAt}) VALUES (${this.#columnsPlaceholders}, $${len + 1}, $${len + 2}) RETURNING *`;

    const { rows } = await Model.#CLIENT.query(insertQuery,
      [...arrangedValues, timestamp, timestamp]
    );

    return rows[0]
  }

  async deleteById(id) {
    await this.#validateBeforeDestroy?.(Model.#CLIENT);
    if (this.paranoid) {
      await Model.#CLIENT.query(`UPDATE ${this.tableName} SET ${this.flags.isDeleted}=$1 WHERE ${this.#pkName}=$2`, [true, id]);
      return true;
    } else {
      await Model.#CLIENT.query(`DELETE FROM ${this.tableName} WHERE ${this.#pkName}=$1`, [id]);
      return true;
    }

  }
}

// static values
Model.prototype.timestamps = { createdAt: 'created_at', updatedAt: 'updated_at' };
Model.prototype.flags = { isDeleted: 'is_deleted' };


module.exports = Model;

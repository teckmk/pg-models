const { PgormError } = require('./errors');
const { getTimestamp, verifyParamType } = require('./util');

// v1.0.7
// tableName with tablePrefix
// model options in constructor {tablePrefix, timestamps, alter, paranoid}

const modalOptions = {
  tableName: '',
  tablePrefix: '',
  tableSchema: 'public',
  pkName: 'id',
  timestamps: false,
  paranoid: false,
  alter: false,
};
/**
 * @class PgormModel
 * @summary
 * Installation: npm install pg-models
 * @example
 * const PgormModel = require('pg-models');
 * @example
 * const Users = new PgormModel('users');
 */
class PgormModel {
  // private fields
  #selectQuery;
  #updateCols;
  #columnsPlaceholders;
  #columnsLen;
  #pkName;
  #validateBeforeCreate;
  #validateBeforeUpdate;
  #validateBeforeDestroy;

  // since v1.0.7
  #tableName;
  #tablePrefix;
  #tableSchema;
  #alterTable;
  #useTimestamps;
  #paranoidTable;

  static models = {}; // since v1.0.7, reference to all instances
  static #CLIENT;

  // private methods
  #arrangeByColumns(valuesObj) {
    verifyParamType(valuesObj, 'object', 'valuesObj', 'arrangeByColumns');

    const arr = [];
    for (const key in this.columns) {
      if (Object.hasOwnProperty.call(this.columns, key)) {
        const element = valuesObj[key] || null;
        arr.push(element);
      }
    }
    return arr; // arrange values acc to columns
  }

  /**
   * @constructor
   * @param {string} modalName - The name of the modal and table
   * @param {modalOptions} options - Modal customization options
   */
  constructor(modelName = '', options = modalOptions) {
    verifyParamType(modelName, 'string', 'modalName', 'constructor');
    verifyParamType(options, 'object', 'modalName', 'constructor');

    // if tableName is provided in options, use that
    if (options.tableName) {
      this.tableName = options.tableName;
    } else {
      // else use modalName as tableName
      this.tableName = options.modelName;
    }

    PgormModel.models[modelName] = this; // add reference of this instance in models static var

    this.pkName = options.pkName;
    this.tableSchema = options.tableSchema;
    this.isTableCreated = false;
    this.customQueries = {};
  }

  set tableName(tableName) {
    this.#tableName = this.tablePrefix + tableName;
  }

  get tableName() {
    return this.#tableName;
  }

  set tablePrefix(prefix) {
    this.#tablePrefix = prefix;
  }

  get tablePrefix() {
    return this.#tablePrefix;
  }

  set tableSchema(schema) {
    this.#tableSchema = schema;
  }

  get tableSchema() {
    return this.#tableSchema;
  }

  set pkName(name) {
    this.#pkName = name;
  }

  get pkName() {
    return this.pkName;
  }

  /**
   * @static
   * @param {PG_Client} dbConnection The pg client object returned by pg.connect()
   * @example
   * PgormModel.useConnection(pgClient);
   */
  static useConnection(dbConnection) {
    PgormModel.#CLIENT = dbConnection;
  }

  /**
   * Creates new table for the model with given configurations. Alters the table if already exists according to the given configurations.
   * @param {Object} columns Table columns with configurations
   * @param {Object} options Options to modify the behaviour of PgormModel
   * @example
   * Users.define({
   *   fullname: {
   *     schema: 'fullname TEXT NOT NULL',
   *     validations: [
   *       function (input, colName) {
   *         if (typeof input !== "string") throw new Error(colName + ' must be a string')
   *       },
   *       function (input, colName) {
   *         if (input.length < 5) throw new Error(colName + ' can not be less than 5 char')
   *       },
   *     ]
   *   },
   *   age: {
   *     schema: 'age INT',
   *     validations: [
   *       function (input) {
   *         if (typeof input !== "number") throw new Error('age must be a number')
   *       }
   *     ]
   *   },
   *   about: {
   *     schema: 'about TEXT'
   *   },
   * });
   */
  define(columns = {}, options = {}) {
    const columnValues = Object.keys(columns),
      timestampsSchema = Object.values(this.timestamps)
        .map((col) => `${col} TIMESTAMP`)
        .join(),
      tableColumnsSchema = [];

    this.columns = columns;
    this.#selectQuery = `SELECT 
      ${this.#pkName},
      ${columnValues.join()},
      ${Object.values(this.timestamps).join()} 
    FROM ${this.tableName}`;

    this.#updateCols = columnValues
      .map((col, index) => `${col}=$${index + 1}`)
      .join(',');

    this.#columnsPlaceholders = columnValues
      .map((_, i) => '$' + (i + 1))
      .join();
    this.#columnsLen = columnValues.length;

    // loop through columns get the name of every column
    for (const [key, value] of Object.entries(columns)) {
      const colName = key;
      tableColumnsSchema.push(value.schema);
    }
    // create table if it doesnt exists
    PgormModel.#CLIENT
      .query(
        `CREATE TABLE IF NOT EXISTS ${this.tableName} (
    ${this.#pkName} SERIAL NOT NULL PRIMARY KEY,
    ${tableColumnsSchema.join()},
    ${timestampsSchema}
    )`
      )
      .then(() => {
        this.isTableCreated = true;

        // get all columns in the table
        return PgormModel.#CLIENT.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='${this.tableSchema}' AND table_name='${this.tableName}'`
        );
      })
      .then(({ rows }) => {
        const tableColumnsNames = rows.map((col) => col.column_name);
        // check if any column is missing in the table
        const missingColumns = Object.keys(this.columns).filter(
          (col) => !tableColumnsNames.includes(col)
        );

        // if any column is missing in the table
        if (missingColumns.length) {
          // add missing columns
          const missingColumnsSchema = missingColumns
            .map((col) => `ADD COLUMN ${this.columns[col].schema}`)
            .join();
          PgormModel.#CLIENT.query(`ALTER TABLE ${this.tableName} 
          ${missingColumnsSchema}`);
        }
      })
      .catch((err) => {
        console.log(err);
        throw new PgormError(
          `Unable to define model for ${this.tableName}`,
          'define'
        );
      });
  }
  // validator function (colValue, colName, inputObj)
  validate(values = {}) {
    // loop through all columns of this model
    for (const key in this.columns) {
      // run all validator functions against user input
      this.columns[key]?.validations?.forEach((fn) =>
        fn?.(values[key], key, values)
      );
    }
  }

  /**
   * Registers a validator hook, which is called before every 'create' operation on this model.
   * Validator function must throw error on validation failure.
   * @param {Function} fn A function to run before PgormModel.create(..) operation
   * @example
   * Users.beforeCreate(async (client, values)=>{
   *   // await client.query(..)
   *   // throws error on validation failure
   * })
   */
  beforeCreate(fn) {
    verifyParamType(fn, 'function', 'fn', 'beforeCreate');
    this.#validateBeforeCreate = fn;
  }

  /**
   * Registers a validator hook, which is called before every 'update' operation on this model.
   * Validator function must throw error on validation failure.
   * @param {Function} fn A function to run before PgormModel.update(..) operation
   * @example
   * Users.beforeUpdate(async (client, recordId)=>{
   *   // await client.query(..)
   *   // throws error on validation failure
   * })
   */
  beforeUpdate(fn) {
    verifyParamType(fn, 'function', 'fn', 'beforeUpdate');
    this.#validateBeforeUpdate = fn;
  }

  /**
   * Registers a validator hook, which is called before every 'delete' operation on this model.
   * Validator function must throw error on validation failure.
   * @param {Function} fn A function to run before PgormModel.destory(..) operation
   * @example
   * Users.beforeDestroy(async (client, recordId)=>{
   *   // await client.query(..)
   *   // throws error on validation failure
   * })
   */
  beforeDestroy(fn) {
    verifyParamType(fn, 'function', 'fn', 'beforeDestroy');
    this.#validateBeforeDestroy = fn;
  }

  /**
   * Creates new function on the model, that can be accessed by the model instance.
   * i.e `MyModel.customQueries.myCustomQueryMethod(..)`
   * @param {String} methodName The name for the function
   * @param {Function} fn A callback which returns a query function to attach to the model,
   * @example
   * Users.addQueryMethod('getByQualification', (client)=>{
   *   // here you define and return your query function
   *   return async (qual_id) => {
   *     // const { rows: usersByQual } = await client.query(..)
   *     // return usersByQual
   *   }
   * });
   *
   * // in users controller
   * await Users.customQueries.getByQualification(1)
   */
  addQueryMethod(methodName, fn) {
    verifyParamType(methodName, 'string', 'methodName', 'addQueryMethod');
    verifyParamType(fn, 'function', 'fn', 'addQueryMethod');

    this.customQueries[methodName] = fn(PgormModel.#CLIENT);
  }

  /**
   * Creates a foreign key.
   * Throws error if the foreign key already exists or column is not defined in parent model.
   * @param {String} fkName Name of the foreign key, fKName must be present in the parent model
   * @param {String} parentTableName The name of the parent table to which key is being linked
   * @example
   * const Books = new PgormModel('books', {
   *   title: {
   *      schema: 'title VARCHAR(255)',
   *   },
   *   user_id: {
   *      schema: 'user_id INT',
   *   },
   * });
   *
   * // create a foreign key on user_id column
   * Books.addForeignKey('user_id', Users.tableName);
   */
  addForeignKey(fkName, parentTableName) {
    verifyParamType(fkName, 'string', 'fkName', 'addForeignKey');
    verifyParamType(
      parentTableName,
      'string',
      'parentTableName',
      'addForeignKey'
    );

    const thisMethodName = 'addForeignKey',
      contraintName = `${this.tableName}_${fkName}_fkey`;

    (async () => {
      try {
        // check if fkName column exists
        const { rows: columns } = await PgormModel.#CLIENT.query(
          `SELECT EXISTS (SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema='${this.tableSchema}' AND table_name='${this.tableName}' AND column_name='${fkName}');`
        );
        if (!columns[0].exists) {
          throw new PgormError(
            `column ${fkName} in addForeignKey does not exist`,
            thisMethodName
          );
        }

        // check if constraint exists already
        const { rows: constraints } = await PgormModel.#CLIENT.query(
          `SELECT EXISTS (SELECT 1 
      FROM information_schema.table_constraints 
      WHERE table_schema='${this.tableSchema}' AND table_name='${this.tableName}' AND constraint_name='${contraintName}');`
        );

        // if foreign key doesnt exist already
        if (!constraints[0].exists) {
          // reference foreign key
          await PgormModel.#CLIENT.query(
            `ALTER TABLE ${this.tableName}
        ADD CONSTRAINT ${contraintName}
        FOREIGN KEY (${fkName})
        REFERENCES "${parentTableName}" (${this.#pkName});`
          );
        }
      } catch (err) {
        throw new PgormError(
          `Unable to create foreign key ${contraintName}: ${err.message}`,
          thisMethodName
        );
      }
    })();
  }

  /**
   * Gets all the results in the model
   * @param {Object} options Options to configure the query
   * @returns Array of results or an empty array
   * @example
   * const users = await Users.findAll();
   */
  async findAll(options) {
    const { rows } = await PgormModel.#CLIENT.query(this.#selectQuery);
    return rows;
  }

  /**
   * Gets all the results in the model, matching whereClause
   * @param {String} whereClause SQL query starting with 'WHERE'
   * @param {Array} paramsArray Array of values for the query placeholders
   * @returns Array of results or an emtpy array
   * @example
   * const users = await Users.findAllWhere('WHERE age>=$1', [20]);
   */
  async findAllWhere(whereClause, paramsArray) {
    verifyParamType(whereClause, 'string', 'whereClause', 'findAllWhere');
    verifyParamType(paramsArray, 'object', 'paramsArray', 'findAllWhere');

    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} ${whereClause}`,
      paramsArray
    );
    return rows;
  }

  /**
   * Gets the one matching result
   * @param {String} column Name of the column to search
   * @param {String} value Value for the column to match
   * @returns Object or null
   * @example
   * const user = await Users.findOne('fullname', 'Ali Hassan');
   */
  async findOne(column, value) {
    verifyParamType(column, 'string', 'column', 'findOne');
    // check if column is in this.columns;
    if (!this.columns[column])
      throw new PgormError('Invalid column name', 'findOne');

    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} where ${column}=$1`,
      [value]
    );
    return rows[0] || null;
  }

  /**
   * Gets the result from the model against the given id.
   * Return null if no result found.
   * @param {Number} id Id of the result
   * @returns Object or null
   * @example
   * const user = await Users.findById(12);
   */
  async findById(id) {
    verifyParamType(id, 'number', 'id', 'findById');

    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} where ${this.#pkName}=$1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Updates the record by given id
   * @param {Number} id Id of the record to be updated
   * @param {Object} values New values for the record
   * @returns Updated record or null
   * @example
   * const updatedUser = await Users.updateById(12,{fullname: 'Ali Hussain', age: 23});
   *
   * if(updatedUsers){
   *    // user updated...
   * } else {
   *    // user not found with that id...
   * }
   */
  async updateById(id, values) {
    verifyParamType(id, 'number', 'id', 'updateById');

    this.validate(values);
    await this.#validateBeforeUpdate?.(PgormModel.#CLIENT, values);

    const len = this.#columnsLen,
      arrangedValues = this.#arrangeByColumns(values),
      updateQuery = `UPDATE ${this.tableName} 
        set ${this.#updateCols}, ${this.timestamps.updatedAt}=$${len + 1}
        where ${this.#pkName}=$${len + 2} RETURNING ${this.#pkName}`;

    const { rows } = await PgormModel.#CLIENT.query(updateQuery, [
      ...arrangedValues,
      getTimestamp(),
      id,
    ]);

    return rows[0] || null;
  }

  /**
   * Creates new record
   * @param {Object} values Values for the new record
   * @returns Created record or null
   * @example
   * const user = await Users.create({fullname: 'Huzaifa Tayyab', age: 23});
   */
  async create(values) {
    verifyParamType(values, 'object', 'values', 'create');

    this.validate(values); // user input validations
    await this.#validateBeforeCreate?.(PgormModel.#CLIENT, values); //record validations

    const len = this.#columnsLen,
      arrangedValues = this.#arrangeByColumns(values),
      timestamp = getTimestamp(),
      insertQuery = `INSERT INTO ${this.tableName} (${Object.keys(
        this.columns
      ).join()},${this.timestamps.updatedAt}, ${
        this.timestamps.createdAt
      }) VALUES (${this.#columnsPlaceholders}, $${len + 1}, $${
        len + 2
      }) RETURNING *`;

    const { rows } = await PgormModel.#CLIENT.query(insertQuery, [
      ...arrangedValues,
      timestamp,
      timestamp,
    ]);

    return rows[0] || null;
  }

  /**
   * Deletes the record by given id
   * @param {Number} id Id of the record to be deleted
   * @returns true
   * @example
   * const isUserDeleted = await Users.deleteById(12);
   *
   * if(isUserDeleted){
   *    // deleted
   * } else {
   *    // user not found with that id
   * }
   */
  async deleteById(id) {
    verifyParamType(id, 'number', 'id', 'deleteById');

    await this.#validateBeforeDestroy?.(PgormModel.#CLIENT, id);

    if (this.paranoid) {
      // if paranoid, do soft delete, put deleted=true
      await PgormModel.#CLIENT.query(
        `UPDATE ${this.tableName} SET ${this.flags.isDeleted}=$1 WHERE ${
          this.#pkName
        }=$2`,
        [true, id]
      );
      return true;
    } else {
      // else do hard delete
      await PgormModel.#CLIENT.query(
        `DELETE FROM ${this.tableName} WHERE ${this.#pkName}=$1`,
        [id]
      );
      return true;
    }
  }
}

// static values
PgormModel.prototype.timestamps = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};
PgormModel.prototype.flags = { isDeleted: 'is_deleted' };

module.exports = PgormModel;

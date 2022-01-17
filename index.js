const { PgormError } = require('./errors');
const { getTimestamp, verifyParamType } = require('./util');

/**
 * @property {string} tablePrefix Prefix for table name
 * @property {string} tableSchema Schema for table
 * @property {string} pkName Name of primary key of table
 * @property {boolean | object} timestamps Whether to add timestamps or not, provide object to override default values
 * @example
 * // timestamps property can be boolean or object
 * timestamps: true
 * // or
 * timestamps: {
 *    createdAt: 'created_at',
 *    updatedAt: 'updated_at',
 *    deletedAt: 'deleted_at',
 * }
 * @property {boolean} paranoid Whether to soft delete or not
 * @property {boolean} alter Whether to alter table (on config change) or not
 * @property {boolean} errorLogs Whether to log errors or not
 */
const globalOptions = {
  tablePrefix: '',
  tableSchema: 'public',
  pkName: 'id',
  timestamps: false,
  paranoid: false,
  alter: false,
  errorLogs: false,
};

/**
 * All globalOptions plus option to change table name
 * @property {tableName} string Name of table for current model
 */
const modalOptions = {
  ...globalOptions,
  tableName: '',
};

const timestampsObj = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
};

/**
 * Validation function for user input validation
 * @param {any} val Value entered for current column
 * @param {string} col Name of current column
 * @param {object} values All user entered values
 */
function validatorFn(val, col, values) {
  throw new Error('validation failed');
}

/**
 * define columns according to following object structure
 * @property {object} columnName Name of the column
 * @property {string} schema Schema of the column
 * @property {Array} validations Array of validation functions
 * @example
 * const columnsObj = {
 *  columnName: {
 *    schema: 'columnName TEXT NOT NULL',
 *    validations: [validatorFn],
 *  },
 *  // ...other columns
 *};
 */
const columnsObj = {
  columnName: {
    schema: 'columnName TEXT NOT NULL',
    validations: [validatorFn],
  },
  // ...other columns
};
// end types

/**
 * @summary
 * Installation: npm install pg-models
 * @example
 * const PgormModel = require('pg-models');
 *
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
  #useTimestamps;
  #paranoidTable;
  #enableErrorLogs;
  #configOptions;

  // since v1.0.7
  static models = {}; // reference to all instances
  static #timestamps = timestampsObj;
  static #globalConfigOptions; // Model wise global options
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

  #checkForDeletion(startWith = 'and') {
    let deleteCheck = '';
    // if modal is paranoid, check if record was not deleted
    if (this.#paranoidTable) {
      deleteCheck = `${startWith} ${PgormModel.#timestamps.deletedAt} is null`;
    }
    return deleteCheck;
  }

  // function which runs all validator functions of all columns
  #validate(values = {}) {
    // loop through all columns of this model
    for (const key in this.columns) {
      // run all validator functions against user input
      this.columns[key]?.validations?.forEach((fn) =>
        fn?.(values[key], key, values)
      );
    }
  }

  /**
   * Creates new modal and relevant table
   * @param {string} modalName - The name of the modal and table
   * @param {modalOptions} options - Modal customization options
   * @constructor
   * @version v1.0.7
   */
  constructor(modelName = '', options = modalOptions) {
    verifyParamType(modelName, 'string', 'modalName', 'constructor');
    verifyParamType(options, 'object', 'options', 'constructor'); // since v1.0.7

    // since v1.0.7
    // overwrite existing if:
    // global config is provided
    // overwrite global if modal wise config is provided
    this.#configOptions = {
      ...modalOptions,
      ...PgormModel.#globalConfigOptions,
      ...options,
    };
    this.#pkName = this.#configOptions.pkName;
    this.#tablePrefix = this.#configOptions.tablePrefix;
    this.#tableSchema = this.#configOptions.tableSchema;
    this.#paranoidTable = this.#configOptions.paranoid;
    this.#enableErrorLogs = this.#configOptions.errorLogs;

    this.isTableCreated = false;
    this.customQueries = {};

    PgormModel.models[modelName] = this; // add reference of this instance in models static var

    // since v1.0.7
    // if tableName is provided in this.#configOptions, use that
    if (this.#configOptions.tableName) {
      // setting tableName using setter
      this.tableName = this.#configOptions.tableName;
    } else {
      // else use modalName as tableName
      this.tableName = modelName;
    }

    // since v1.0.7
    // if this.#configOptions.timestamps = bool
    if (typeof this.#configOptions.timestamps === 'boolean') {
      this.#useTimestamps = this.#configOptions.timestamps; // enable/disable timestamps
    }
    // if this.#configOptions.timestamps = object, means dev wants to rename timestamps
    else if (typeof this.#configOptions.timestamps === 'object') {
      //1- enable timestamps
      this.#useTimestamps = true;

      //2- then overwrite crr values with provided vals
      PgormModel.#timestamps = {
        ...PgormModel.#timestamps,
        ...this.#configOptions.timestamps,
      };
    }
  }

  /**
   * gets or sets the table name (with prefix)
   */
  set tableName(tableName) {
    this.#tableName = this.#tablePrefix + tableName;
  }

  get tableName() {
    return this.#tableName;
  }

  /**
   * @static
   * @param {PG_Client} dbConnection The pg client object returned by `pg.connect()`
   * @example
   * PgormModel.useConnection(pgClient);
   * @static
   */
  static useConnection(dbConnection) {
    PgormModel.#CLIENT = dbConnection;
  }

  /**
   * Sets options for `PgormModel` class that will apply to all instances of this class.
   * Use this method if you want to customize all models once.
   * @param {globalOptions} options Configuration options.
   * @static
   */
  static setOptions(options) {
    // overwrite global options with provided ones
    PgormModel.#globalConfigOptions = { ...globalOptions, ...options };
  }

  /**
   * Creates new table for the model with given configurations. Alters the table if already exists according to the given configurations.
   * @param {columnsObj} columns Table columns with configurations
   * @param {object} options Options to modify the behaviour of PgormModel
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
  define(columns = {}) {
    const tableColumnsSchema = [];
    const columnValues = Object.keys(columns); // get all column names

    // get timestamps names and generate schema
    const timestampsSchema = Object.values(PgormModel.#timestamps).map(
      (col) => `${col} TIMESTAMP`
    );

    this.columns = columns; // set columns to be accessibe in the class

    // columns for select query
    let selectColumns = `${this.#pkName},${columnValues.join()}`;

    // include timestamps columns if enabled
    if (this.#useTimestamps) {
      selectColumns += `,${Object.values(PgormModel.#timestamps).join()}`;
    }

    // select query string
    this.#selectQuery = `SELECT ${selectColumns} FROM ${this.tableName}`;

    // prepare update cols string with placeholers i.e col=$1, col2=$2...
    this.#updateCols = columnValues
      .map((col, index) => `${col}=$${index + 1}`)
      .join(',');

    // prepare cols string for create query
    this.#columnsPlaceholders = columnValues
      .map((_, i) => '$' + (i + 1))
      .join();

    // calculate columns length so that it can be used in the class
    this.#columnsLen = columnValues.length;

    // loop through columns get the schema of every column
    for (const [key, value] of Object.entries(columns)) {
      tableColumnsSchema.push(value.schema);
    }

    // columns schema for the create table query
    let createTableCols = `${this.#pkName} SERIAL NOT NULL PRIMARY KEY,
    ${tableColumnsSchema.join()}`;

    // if timestamps are enabled, add timestamps as table columns
    if (this.#useTimestamps) {
      createTableCols += `,${timestampsSchema.join()}`;
    }

    // create table if it doesnt exists
    PgormModel.#CLIENT
      .query(
        `CREATE TABLE IF NOT EXISTS ${this.tableName} (${createTableCols})`
      )
      .then(() => {
        this.isTableCreated = true;

        // get all columns in the table
        return PgormModel.#CLIENT.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='${
            this.#tableSchema
          }' AND table_name='${this.tableName}'`
        );
      })
      .then(({ rows }) => {
        // get column names from the result
        const tableColumnsNames = rows.map((col) => col.column_name);
        // check if any column from columnsObj is missing in the table
        const missingColumns = Object.keys(this.columns).filter(
          (col) => !tableColumnsNames.includes(col)
        );

        // check if timestamps are enabled and are missing in the table
        const missingTimestamps = Object.values(PgormModel.#timestamps).filter(
          (ts) => !tableColumnsNames.includes(ts)
        );

        // if any column (or timestamp) is missing in the table
        // and #configOptions.alter is set to true
        if (this.#configOptions.alter) {
          let colsSchema = '';
          if (missingColumns.length) {
            // prepare schema for missing columns
            colsSchema = missingColumns
              .map((col) => `ADD COLUMN ${this.columns[col].schema}`)
              .join();
          }
          if (missingTimestamps.length && this.#useTimestamps) {
            // if colsSchema is not empty, add trailing comma
            if (colsSchema !== '') {
              colsSchema += ',';
            }
            // append schema for timestamps
            colsSchema += `${timestampsSchema
              .map((col) => `ADD COLUMN IF NOT EXISTS ${col}`)
              .join()}`;
          }

          // if colsSchema is not empty
          if (colsSchema && colsSchema !== '') {
            // add missing columns in the table
            PgormModel.#CLIENT.query(`ALTER TABLE ${this.tableName} 
          ${colsSchema}`);
          }
        }

        // if (missingColumns.length && this.#configOptions.alter) {
        //   // prepare query for missing columns
        //   let missingColumnsSchema = missingColumns
        //     .map((col) => `ADD COLUMN ${this.columns[col].schema}`)
        //     .join();

        //   // add missing columns in the table
        //   PgormModel.#CLIENT.query(`ALTER TABLE ${this.tableName}
        //   ${missingColumnsSchema}`);
        // }
      })
      .catch((err) => {
        if (this.#enableErrorLogs) {
          console.log(err);
        }
        throw new PgormError(
          `Unable to define model for ${this.tableName}`,
          'define'
        );
      });
  }

  /**
   * Gets all the results in the model
   * @param {Object} options Options to configure the query
   * @returns Array of results or an empty array
   * @async
   * @example
   * const users = await Users.findAll();
   */
  async findAll(options) {
    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} ${this.#checkForDeletion('WHERE')}`
    );
    return rows;
  }

  /**
   * Gets all the results in the model, matching whereClause
   * @param {String} whereClause SQL query starting with 'WHERE'
   * @param {Array} paramsArray Array of values for the query placeholders
   * @returns Array of results or an emtpy array
   * @async
   * @example
   * const users = await Users.findAllWhere('WHERE age>=$1', [20]);
   */
  async findAllWhere(whereClause, paramsArray) {
    verifyParamType(whereClause, 'string', 'whereClause', 'findAllWhere');
    verifyParamType(paramsArray, 'object', 'paramsArray', 'findAllWhere');

    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} ${whereClause} ${this.#checkForDeletion()}`,
      paramsArray
    );
    return rows;
  }

  /**
   * Gets the one matching result
   * @param {String} column Name of the column to search
   * @param {String} value Value for the column to match
   * @returns Object or null
   * @async
   * @example
   * const user = await Users.findOne('fullname', 'Ali Hassan');
   */
  async findOne(column, value) {
    verifyParamType(column, 'string', 'column', 'findOne');
    // check if column is in this.columns;
    if (!this.columns[column]) {
      throw new PgormError('Invalid column name', 'findOne');
    }

    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} where ${column}=$1 ${this.#checkForDeletion()}`,
      [value]
    );
    return rows[0] || null;
  }

  /**
   * Gets the result from the model against the given id.
   * Return null if no result found.
   * @param {Number} id Id of the result
   * @returns Object or null
   * @async
   * @example
   * const user = await Users.findById(12);
   */
  async findById(id) {
    verifyParamType(id, 'number', 'id', 'findById');

    const { rows } = await PgormModel.#CLIENT.query(
      `${this.#selectQuery} where ${
        this.#pkName
      }=$1 ${this.#checkForDeletion()}`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Updates the record by given id
   * @param {Number} id Id of the record to be updated
   * @param {Object} values New values for the record
   * @returns Updated record or null
   * @async
   * @example
   * const updatedUser = await Users.updateById(12,{fullname: 'Ali Hussain', age: 23});
   *
   * if(updatedUsers){
   *    // user updated do something with updatedUser...
   * } else {
   *    // user not found with that id...
   * }
   */
  async updateById(id, values) {
    verifyParamType(id, 'number', 'id', 'updateById');

    this.#validate(values);
    await this.#validateBeforeUpdate?.(PgormModel.#CLIENT, values);

    const len = this.#columnsLen;
    const arrangedValues = this.#arrangeByColumns(values);

    let columns = `${this.#updateCols}`;
    let updateValues = arrangedValues;

    // if timestamps are enabled, update value for updatedAt col
    if (this.#useTimestamps) {
      columns += `,${PgormModel.#timestamps.updatedAt}=$${len + 1}`;
      updateValues = [...arrangedValues, getTimestamp()];
    }

    const updateQuery = `UPDATE ${this.tableName} 
        set ${columns}
        where ${this.#pkName}=$${len + 2} RETURNING *`;

    const { rows } = await PgormModel.#CLIENT.query(updateQuery, [
      ...updateValues,
      id,
    ]);

    return rows[0] || null;
  }

  /**
   * Creates new record
   * @param {Object} values Values for the new record
   * @returns Created record or null
   * @async
   * @example
   * const user = await Users.create({fullname: 'Huzaifa Tayyab', age: 23});
   */
  async create(values) {
    verifyParamType(values, 'object', 'values', 'create');

    this.#validate(values); // run user input validations
    await this.#validateBeforeCreate?.(PgormModel.#CLIENT, values); // run record validations

    const len = this.#columnsLen;
    const arrangedValues = this.#arrangeByColumns(values);
    const timestamp = getTimestamp();
    const timestampsCols = Object.values(PgormModel.#timestamps);
    const columns = Object.keys(this.columns);

    // placeholders for timestamp cols i.e. $(len+1), $(len+2);
    // i is 0 based so added one in it
    const timestampPlaceholders = timestampsCols
      .map((_, i) => '$' + (len + i + 1))
      .join();

    let insertColumns = columns.join();
    let insertPlaceholders = this.#columnsPlaceholders;
    let insertValues = arrangedValues;

    // if timestamps are enables, append timestamps config in query
    if (this.#useTimestamps) {
      // alphabatically sorted timestamps col names [createdAt,deletedAt,updatedAt]
      insertColumns += `,${timestampsCols.sort().join()}`;
      insertPlaceholders += `,${timestampPlaceholders}`;

      // concating timetamps values in arr
      insertValues = [
        ...insertValues,
        timestamp, // createdAt
        null, // deletedAt
        timestamp, // updatedAt
      ];
    }

    const insertQuery = `INSERT INTO ${this.tableName} (${insertColumns}) VALUES (${insertPlaceholders}) RETURNING *`;
    const { rows } = await PgormModel.#CLIENT.query(insertQuery, insertValues);

    return rows[0] || null;
  }

  /**
   * Deletes the record by given id
   * @param {Number} id Id of the record to be deleted
   * @returns boolean
   * @async
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

    // run record validation hook, if provided
    await this.#validateBeforeDestroy?.(PgormModel.#CLIENT, id);

    // if record not found with id return false
    const record = await this.findById(id);
    if (!record) {
      return false;
    }

    // if paranoid, do soft delete, put deleted=true
    if (this.#paranoidTable) {
      // throw error if timestamps are not enabled
      if (!this.#useTimestamps) {
        throw new PgormError(
          'modalOptions.timestamps need to be enabled for modalOptions.paranoid to work.',
          'deleteById'
        );
      }
      await PgormModel.#CLIENT.query(
        `UPDATE ${this.tableName} SET ${
          PgormModel.#timestamps.deletedAt
        }=$1 WHERE ${this.#pkName}=$2`,
        [getTimestamp(), id]
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
   * Creates a foreign key. fkName must be present in the model
   * Throws error if the foreign key already exists or column is not defined in the model.
   * @param {String} fkName Name of the foreign key
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

    const thisMethodName = 'addForeignKey';
    const contraintName = `${this.tableName}_${fkName}_fkey`;

    (async () => {
      try {
        // check if fkName column exists in this table
        const { rows: columns } = await PgormModel.#CLIENT.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema='${this.#tableSchema}' 
            AND table_name='${this.#tableName}' 
            AND column_name='${fkName}'
          );`
        );

        // if foreign key column is not found, throw err
        if (!columns[0].exists) {
          throw new PgormError(
            `column ${fkName} does not exist in ${
              this.#tableName
            }, in addForeignKey`,
            thisMethodName
          );
        }

        // check if constraint exists already
        const { rows: constraints } = await PgormModel.#CLIENT.query(
          `SELECT EXISTS (SELECT 1 
      FROM information_schema.table_constraints 
      WHERE table_schema='${this.#tableSchema}' AND table_name='${
            this.tableName
          }' AND constraint_name='${contraintName}');`
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
}

module.exports = PgormModel;

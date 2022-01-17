# PgormModel

#### _`ORM` essentials for code written using default `pg` driver_

## Features

- Ports easily with existing default pg-driver code
- Built in basic `CRUD` methods
- Creates models and relevant tables
- Plain SQL schema for model columns
- User input validation right in the model
- Record validation hooks for `create`, `update` and `delete` operations
- Enhance model functionaliy by adding custom query methods to it
- Customize individual model behavior or of all instances
- Linking to existing tables by adding foreight keys

## Installation

`PgormModel` requires [Node.js](https://nodejs.org/) v14+ to run.

```sh
npm install --save pg-models
```

# API Reference

## Classes

<dl>
<dt><a href="#PgormModel">PgormModel</a></dt>
<dd></dd>
</dl>

## Constants

<dl>
<dt><a href="#globalOptions">globalOptions</a></dt>
<dd></dd>
<dt><a href="#modalOptions">modalOptions</a></dt>
<dd><p>All globalOptions plus option to change table name</p>
</dd>
<dt><a href="#columnsObj">columnsObj</a></dt>
<dd><p>define columns according to following object structure</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#validatorFn">validatorFn(val, col, values)</a></dt>
<dd><p>Validation function for user input validation</p>
</dd>
</dl>

<a name="PgormModel"></a>

## PgormModel

**Kind**: global class  
**Summary**: Installation: npm install pg-models  
**Version**: v1.0.7

- [PgormModel](#pgormmodel)
      - [_`ORM` essentials for code written using default `pg` driver_](#orm-essentials-for-code-written-using-default-pg-driver)
  - [Features](#features)
  - [Installation](#installation)
- [API Reference](#api-reference)
  - [Classes](#classes)
  - [Constants](#constants)
  - [Functions](#functions)
  - [PgormModel](#pgormmodel-1)
    - [new PgormModel(modalName, options)](#new-pgormmodelmodalname-options)
    - [pgormModel.tableName](#pgormmodeltablename)
    - [pgormModel.define(columns, options)](#pgormmodeldefinecolumns-options)
    - [pgormModel.findAll(options) ⇒](#pgormmodelfindalloptions-)
    - [pgormModel.findAllWhere(whereClause, paramsArray) ⇒](#pgormmodelfindallwherewhereclause-paramsarray-)
    - [pgormModel.findOne(column, value) ⇒](#pgormmodelfindonecolumn-value-)
    - [pgormModel.findById(id) ⇒](#pgormmodelfindbyidid-)
    - [pgormModel.updateById(id, values) ⇒](#pgormmodelupdatebyidid-values-)
    - [pgormModel.create(values) ⇒](#pgormmodelcreatevalues-)
    - [pgormModel.deleteById(id) ⇒](#pgormmodeldeletebyidid-)
    - [pgormModel.beforeCreate(fn)](#pgormmodelbeforecreatefn)
    - [pgormModel.beforeUpdate(fn)](#pgormmodelbeforeupdatefn)
    - [pgormModel.beforeDestroy(fn)](#pgormmodelbeforedestroyfn)
    - [pgormModel.addQueryMethod(methodName, fn)](#pgormmodeladdquerymethodmethodname-fn)
    - [pgormModel.addForeignKey(fkName, parentTableName)](#pgormmodeladdforeignkeyfkname-parenttablename)
    - [PgormModel.useConnection(dbConnection)](#pgormmodeluseconnectiondbconnection)
    - [PgormModel.setOptions(options)](#pgormmodelsetoptionsoptions)
  - [globalOptions](#globaloptions)
  - [modalOptions](#modaloptions)
  - [columnsObj](#columnsobj)
  - [validatorFn(val, col, values)](#validatorfnval-col-values)

<a name="new_PgormModel_new"></a>

### new PgormModel(modalName, options)

Creates new modal and relevant table

| Param     | Type                                       | Description                     |
| --------- | ------------------------------------------ | ------------------------------- |
| modalName | <code>string</code>                        | The name of the modal and table |
| options   | [<code>modalOptions</code>](#modalOptions) | Modal customization options     |

**Example**

```js
const PgormModel = require('pg-models');

const Users = new PgormModel('users');
```

<a name="PgormModel+tableName"></a>

### pgormModel.tableName

gets or sets the table name (with prefix)

**Kind**: instance property of [<code>PgormModel</code>](#PgormModel)  
<a name="PgormModel+define"></a>

### pgormModel.define(columns, options)

Creates new table for the model with given configurations. Alters the table if already exists according to the given configurations.

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)

| Param   | Type                                   | Description                                   |
| ------- | -------------------------------------- | --------------------------------------------- |
| columns | [<code>columnsObj</code>](#columnsObj) | Table columns with configurations             |
| options | <code>object</code>                    | Options to modify the behaviour of PgormModel |

**Example**

```js
Users.define({
  fullname: {
    schema: 'fullname TEXT NOT NULL',
    validations: [
      function (input, colName) {
        if (typeof input !== 'string')
          throw new Error(colName + ' must be a string');
      },
      function (input, colName) {
        if (input.length < 5)
          throw new Error(colName + ' can not be less than 5 char');
      },
    ],
  },
  age: {
    schema: 'age INT',
    validations: [
      function (input) {
        if (typeof input !== 'number') throw new Error('age must be a number');
      },
    ],
  },
  about: {
    schema: 'about TEXT',
  },
});
```

<a name="PgormModel+findAll"></a>

### pgormModel.findAll(options) ⇒

Gets all the results in the model

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: Array of results or an empty array

| Param   | Type                | Description                    |
| ------- | ------------------- | ------------------------------ |
| options | <code>Object</code> | Options to configure the query |

**Example**

```js
const users = await Users.findAll();
```

<a name="PgormModel+findAllWhere"></a>

### pgormModel.findAllWhere(whereClause, paramsArray) ⇒

Gets all the results in the model, matching whereClause

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: Array of results or an emtpy array

| Param       | Type                | Description                                |
| ----------- | ------------------- | ------------------------------------------ |
| whereClause | <code>String</code> | SQL query starting with 'WHERE'            |
| paramsArray | <code>Array</code>  | Array of values for the query placeholders |

**Example**

```js
const users = await Users.findAllWhere('WHERE age>=$1', [20]);
```

<a name="PgormModel+findOne"></a>

### pgormModel.findOne(column, value) ⇒

Gets the one matching result

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: Object or null

| Param  | Type                | Description                   |
| ------ | ------------------- | ----------------------------- |
| column | <code>String</code> | Name of the column to search  |
| value  | <code>String</code> | Value for the column to match |

**Example**

```js
const user = await Users.findOne('fullname', 'Ali Hassan');
```

<a name="PgormModel+findById"></a>

### pgormModel.findById(id) ⇒

Gets the result from the model against the given id.
Return null if no result found.

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: Object or null

| Param | Type                | Description      |
| ----- | ------------------- | ---------------- |
| id    | <code>Number</code> | Id of the result |

**Example**

```js
const user = await Users.findById(12);
```

<a name="PgormModel+updateById"></a>

### pgormModel.updateById(id, values) ⇒

Updates the record by given id

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: Updated record or null

| Param  | Type                | Description                    |
| ------ | ------------------- | ------------------------------ |
| id     | <code>Number</code> | Id of the record to be updated |
| values | <code>Object</code> | New values for the record      |

**Example**

```js
const updatedUser = await Users.updateById(12, {
  fullname: 'Ali Hussain',
  age: 23,
});

if (updatedUsers) {
  // user updated do something with updatedUser...
} else {
  // user not found with that id...
}
```

<a name="PgormModel+create"></a>

### pgormModel.create(values) ⇒

Creates new record

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: Created record or null

| Param  | Type                | Description               |
| ------ | ------------------- | ------------------------- |
| values | <code>Object</code> | Values for the new record |

**Example**

```js
const user = await Users.create({ fullname: 'Huzaifa Tayyab', age: 23 });
```

<a name="PgormModel+deleteById"></a>

### pgormModel.deleteById(id) ⇒

Deletes the record by given id

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)  
**Returns**: boolean

| Param | Type                | Description                    |
| ----- | ------------------- | ------------------------------ |
| id    | <code>Number</code> | Id of the record to be deleted |

**Example**

```js
const isUserDeleted = await Users.deleteById(12);

if (isUserDeleted) {
  // deleted
} else {
  // user not found with that id
}
```

<a name="PgormModel+beforeCreate"></a>

### pgormModel.beforeCreate(fn)

Registers a validator hook, which is called before every 'create' operation on this model.
Validator function must throw error on validation failure.

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)

| Param | Type                  | Description                                              |
| ----- | --------------------- | -------------------------------------------------------- |
| fn    | <code>function</code> | A function to run before PgormModel.create(..) operation |

**Example**

```js
Users.beforeCreate(async (client, values) => {
  // await client.query(..)
  // throws error on validation failure
});
```

<a name="PgormModel+beforeUpdate"></a>

### pgormModel.beforeUpdate(fn)

Registers a validator hook, which is called before every 'update' operation on this model.
Validator function must throw error on validation failure.

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)

| Param | Type                  | Description                                              |
| ----- | --------------------- | -------------------------------------------------------- |
| fn    | <code>function</code> | A function to run before PgormModel.update(..) operation |

**Example**

```js
Users.beforeUpdate(async (client, recordId) => {
  // await client.query(..)
  // throws error on validation failure
});
```

<a name="PgormModel+beforeDestroy"></a>

### pgormModel.beforeDestroy(fn)

Registers a validator hook, which is called before every 'delete' operation on this model.
Validator function must throw error on validation failure.

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)

| Param | Type                  | Description                                               |
| ----- | --------------------- | --------------------------------------------------------- |
| fn    | <code>function</code> | A function to run before PgormModel.destory(..) operation |

**Example**

```js
Users.beforeDestroy(async (client, recordId) => {
  // await client.query(..)
  // throws error on validation failure
});
```

<a name="PgormModel+addQueryMethod"></a>

### pgormModel.addQueryMethod(methodName, fn)

Creates new function on the model, that can be accessed by the model instance.
i.e `MyModel.customQueries.myCustomQueryMethod(..)`

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)

| Param      | Type                  | Description                                                       |
| ---------- | --------------------- | ----------------------------------------------------------------- |
| methodName | <code>String</code>   | The name for the function                                         |
| fn         | <code>function</code> | A callback which returns a query function to attach to the model, |

**Example**

```js
Users.addQueryMethod('getByQualification', (client) => {
  // here you define and return your query function
  return async (qual_id) => {
    // const { rows: usersByQual } = await client.query(..)
    // return usersByQual
  };
});

// in users controller
await Users.customQueries.getByQualification(1);
```

<a name="PgormModel+addForeignKey"></a>

### pgormModel.addForeignKey(fkName, parentTableName)

Creates a foreign key. fkName must be present in the model
Throws error if the foreign key already exists or column is not defined in the model.

**Kind**: instance method of [<code>PgormModel</code>](#PgormModel)

| Param           | Type                | Description                                               |
| --------------- | ------------------- | --------------------------------------------------------- |
| fkName          | <code>String</code> | Name of the foreign key                                   |
| parentTableName | <code>String</code> | The name of the parent table to which key is being linked |

**Example**

```js
const Books = new PgormModel('books', {
  title: {
    schema: 'title VARCHAR(255)',
  },
  user_id: {
    schema: 'user_id INT',
  },
});

// create a foreign key on user_id column
Books.addForeignKey('user_id', Users.tableName);
```

<a name="PgormModel.useConnection"></a>

### PgormModel.useConnection(dbConnection)

**Kind**: static method of [<code>PgormModel</code>](#PgormModel)

| Param        | Type                   | Description                                     |
| ------------ | ---------------------- | ----------------------------------------------- |
| dbConnection | <code>PG_Client</code> | The pg client object returned by `pg.connect()` |

**Example**

```js
PgormModel.useConnection(pgClient);
```

<a name="PgormModel.setOptions"></a>

### PgormModel.setOptions(options)

Sets options for `PgormModel` class that will apply to all instances of this class.
Use this method if you want to customize all models once.

**Kind**: static method of [<code>PgormModel</code>](#PgormModel)

| Param   | Type                                         | Description            |
| ------- | -------------------------------------------- | ---------------------- |
| options | [<code>globalOptions</code>](#globalOptions) | Configuration options. |

<a name="globalOptions"></a>

## globalOptions

**Kind**: global constant  
**Properties**

| Name        | Type                                        | Description                                                                 |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| tablePrefix | <code>string</code>                         | Prefix for table name                                                       |
| tableSchema | <code>string</code>                         | Schema for table                                                            |
| pkName      | <code>string</code>                         | Name of primary key of table                                                |
| timestamps  | <code>boolean</code> \| <code>object</code> | Whether to add timestamps or not, provide object to override default values |
| paranoid    | <code>boolean</code>                        | Whether to soft delete or not                                               |
| alter       | <code>boolean</code>                        | Whether to alter table (on config change) or not                            |
| errorLogs   | <code>boolean</code>                        | Whether to log errors or not                                                |

**Example**

```js
// timestamps property can be boolean or object
timestamps: true
// or
timestamps: {
   createdAt: 'created_at',
   updatedAt: 'updated_at',
   deletedAt: 'deleted_at',
}
```

<a name="modalOptions"></a>

## modalOptions

All globalOptions plus option to change table name

**Kind**: global constant  
**Properties**

| Name   | Type                   | Description                     |
| ------ | ---------------------- | ------------------------------- |
| string | <code>tableName</code> | Name of table for current model |

<a name="columnsObj"></a>

## columnsObj

define columns according to following object structure

**Kind**: global constant  
**Properties**

| Name        | Type                | Description                   |
| ----------- | ------------------- | ----------------------------- |
| columnName  | <code>object</code> | Name of the column            |
| schema      | <code>string</code> | Schema of the column          |
| validations | <code>Array</code>  | Array of validation functions |

**Example**

```js
const columnsObj = {
  columnName: {
    schema: 'columnName TEXT NOT NULL',
    validations: [validatorFn],
  },
  // ...other columns
};
```

<a name="validatorFn"></a>

## validatorFn(val, col, values)

Validation function for user input validation

**Kind**: global function

| Param  | Type                | Description                      |
| ------ | ------------------- | -------------------------------- |
| val    | <code>any</code>    | Value entered for current column |
| col    | <code>string</code> | Name of current column           |
| values | <code>object</code> | All user entered values          |

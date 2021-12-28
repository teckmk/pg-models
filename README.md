# pg-models _1.0.1_

> ORM to use with your existing pg driver code

### PgormModel

#### new PgormModel()

Represents PgormModel class

##### Examples

```javascript
const Users = new PgormModel('users');
```

##### Returns

- `Void`

#### PgormModel.constructor(tableName)

##### Parameters

| Name      | Type     | Description             |        |
| --------- | -------- | ----------------------- | ------ |
| tableName | `string` | - The name of the table | &nbsp; |

##### Returns

- `Void`

#### PgormModel.useConnection(dbConnection)

##### Parameters

| Name         | Type        | Description          |        |
| ------------ | ----------- | -------------------- | ------ |
| dbConnection | `PG_Client` | The pg client object | &nbsp; |

##### Examples

```javascript
PgormModel.use(pgClient);
```

##### Returns

- `Void`

#### PgormModel.define(columns, options)

Creates new table for the model with given configurations

##### Parameters

| Name    | Type     | Description                                   |        |
| ------- | -------- | --------------------------------------------- | ------ |
| columns | `Object` | Table columns with configurations             | &nbsp; |
| options | `Object` | Options to modify the behaviour of PgormModel | &nbsp; |

##### Examples

```javascript
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

##### Returns

- `Void`

#### PgormModel.beforeCreate(fn)

Registers a validator function, validator function can throw error on validation failure

##### Parameters

| Name | Type       | Description                                              |        |
| ---- | ---------- | -------------------------------------------------------- | ------ |
| fn   | `Function` | A function to run before PgormModel.create(..) operation | &nbsp; |

##### Examples

```javascript
Users.beforeCreate(async (client) => {
  // await client.query(..)
  // throws error on validation failure
});
```

##### Returns

- `Void`

#### PgormModel.beforeUpdate(fn)

Registers a validator function

##### Parameters

| Name | Type       | Description                                              |        |
| ---- | ---------- | -------------------------------------------------------- | ------ |
| fn   | `Function` | A function to run before PgormModel.update(..) operation | &nbsp; |

##### Examples

```javascript
Users.beforeUpdate(async (client) => {
  // await client.query(..)
  // throws error on validation failure
});
```

##### Returns

- `Void`

#### PgormModel.beforeDestroy(fn)

Registers a validator function

##### Parameters

| Name | Type       | Description                                               |        |
| ---- | ---------- | --------------------------------------------------------- | ------ |
| fn   | `Function` | A function to run before PgormModel.destory(..) operation | &nbsp; |

##### Examples

```javascript
Users.beforeDestroy(async (client) => {
  // await client.query(..)
  // throws error on validation failure
});
```

##### Returns

- `Void`

#### PgormModel.addQueryMethod(methodName, fn)

Creates new function on the model

##### Parameters

| Name       | Type       | Description               |        |
| ---------- | ---------- | ------------------------- | ------ |
| methodName | `String`   | The name for the function | &nbsp; |
| fn         | `Function` | A function to add         | &nbsp; |

##### Examples

```javascript
Users.addQueryMethod('getByQualification', (client) => {
  return async (qual_id) => {
    // const { rows: usersByQual } = await client.query(..)
    // return usersByQual
  };
});

// in users controller
await Users.getByQualification(1);
```

##### Returns

- `Void`

#### PgormModel.addForeignKey(fkName, parentTableName)

Creates a foreign key

##### Parameters

| Name            | Type     | Description                                               |        |
| --------------- | -------- | --------------------------------------------------------- | ------ |
| fkName          | `String` | Name of the foreign key                                   | &nbsp; |
| parentTableName | `String` | The name of the parent table to which key is being linked | &nbsp; |

##### Examples

```javascript
Users.addForeignKey('qualification_id', 'qualifications');
```

##### Returns

- `Void`

_Documentation generated with [doxdox](https://github.com/neogeek/doxdox)._

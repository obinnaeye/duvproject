import { config as getEnv } from 'dotenv';


getEnv();
const environment = process.env.NODE_ENV || 'development';
const url = process.env.DATABASE_URL;
const devMode = environment === ('development' || 'test');

export const config = {
  url,
  dialect: 'postgres',
  logging: devMode ? log => log : false,
  dialectOptions: {
    multipleStatements: true,
  },
  operatorsAliases: false,
  pool: {
    max: 5,
    min: 0,
    idle: 10000,
  },
  define: {
    underscored: false,
    version: true
  },
};

if (!devMode) {
  config.ssl = true;
  config.dialectOptions.ssl = {
    require: !devMode
  };
}

/**
 * SequelizeNoUpdateAttributes - Add No Update fields to sequelize
 *
 * @export
 * @param {oject} sequelize the sequelize instance
 *
 * @return {null} no return
 */
export function SequelizeNoUpdateAttributes(sequelize) {
  /* eslint-disable no-underscore-dangle */
  if (!sequelize) {
    throw new Error('The required sequelize instance option is missing');
  }

  sequelize.addHook('beforeValidate', (instance, options) => {
    if (!options.validate) {
      return;
    }
    if (instance.isNewRecord) {
      return;
    }

    const changedKeys = [];

    Object
      .keys(instance._changed)
      .forEach((fieldName) => {
        if (instance._changed[fieldName]) {
          changedKeys.push(fieldName);
        }
      });

    if (!changedKeys.length) {
      return;
    }

    const validationErrors = [];
    changedKeys.forEach((fieldName) => {
      const fieldDefinition = instance.rawAttributes[fieldName];

      if (!fieldDefinition.noUpdate) {
        return;
      }
      if (fieldDefinition.noUpdate.readOnly) {
        validationErrors.push(new sequelize.ValidationErrorItem(
          `\`${fieldName}\` cannot be updated due to \`noUpdate:readOnly\` constraint`,
          'readOnly Violation',
          fieldName,
          instance[fieldName]
        ));
        return;
      }
      const value = instance._previousDataValues[fieldName];
      if (value !== null) {
        validationErrors.push(new sequelize.ValidationErrorItem(
          `\`${fieldName}\` cannot be updated due to \`noUpdate\` constraint`,
          'noUpdate Violation', fieldName, instance[fieldName]
        ));
      }
    });

    if (validationErrors.length) {
      return sequelize.Promise.try(() => {
        throw new sequelize.ValidationError(null, validationErrors);
      });
    }
  });
}

module.exports = config;
module.exports.config = config;
module.exports.SequelizeNoUpdateAttributes = SequelizeNoUpdateAttributes;

const _ = require('lodash');

/**
 * Throws an ApolloError if context body contains a bad request
 * @param contextBody - body of the context object given to the resolver
 * @throws ApolloError if the body is a bad request
 */
function checkBadRequest(contextBody) {
  if (_.get(contextBody, 'output.payload.statusCode', 200) !== 200) {
    const statusCode = _.get(contextBody, 'output.payload.statusCode', 400);
    const message = _.get(contextBody, 'output.payload.message', 'Bad Request');
    throw new Error(message, statusCode, _.omit(contextBody, ['output']));
  }
}

module.exports = {
  type: {
    UsersPermissionsPermission: false, // Make this type NOT queriable.
  },
  definition: /* GraphQL */ `
    type UsersPermissionsMe {
      id: ID!
      username: String!
      email: String!
      confirmed: Boolean
      blocked: Boolean
      roles: [UsersPermissionsMeRole]
    }

    type UsersPermissionsMeRole {
      id: ID!
      name: String!
      description: String
      type: String
    }

    input UsersPermissionsLoginInput {
      identifier: String!
      password: String!
      provider: String = "local"
    }

    type UsersPermissionsLoginPayload {
      jwt: String!
      user: UsersPermissionsMe!
    }
  `,
  query: `
    me: UsersPermissionsMe
  `,
  mutation: `
    login(input: UsersPermissionsLoginInput!): UsersPermissionsLoginPayload!
    register(input: UserInput!): UsersPermissionsLoginPayload!
  `,
  resolver: {
    Query: {
      me: {
        resolver: 'plugins::users-permissions.user.me',
      },
      role: {
        resolverOf: 'plugins::users-permissions.userspermissions.getRole',
        resolver: async (obj, options, { context }) => {
          context.params = { ...context.params, ...options.input };

          await strapi.plugins['users-permissions'].controllers.userspermissions.getRole(context);

          return context.body.role;
        },
      },
      roles: {
        description: `Retrieve all the existing roles. You can't apply filters on this query.`,
        resolverOf: 'plugins::users-permissions.userspermissions.getRoles', // Apply the `getRoles` permissions on the resolver.
        resolver: async (obj, options, { context }) => {
          context.params = { ...context.params, ...options.input };

          await strapi.plugins['users-permissions'].controllers.userspermissions.getRoles(context);

          return context.body.roles;
        },
      },
    },
    Mutation: {
      createRole: {
        description: 'Create a new role',
        resolverOf: 'plugins::users-permissions.userspermissions.createRole',
        resolver: async (obj, options, { context }) => {
          await strapi.plugins['users-permissions'].controllers.userspermissions.createRole(
            context
          );

          return { ok: true };
        },
      },
      updateRole: {
        description: 'Update an existing role',
        resolverOf: 'plugins::users-permissions.userspermissions.updateRole',
        resolver: async (obj, options, { context }) => {
          await strapi.plugins['users-permissions'].controllers.userspermissions.updateRole(
            context.params,
            context.body
          );

          return { ok: true };
        },
      },
      deleteRole: {
        description: 'Delete an existing role',
        resolverOf: 'plugins::users-permissions.userspermissions.deleteRole',
        resolver: async (obj, options, { context }) => {
          await strapi.plugins['users-permissions'].controllers.userspermissions.deleteRole(
            context
          );

          return { ok: true };
        },
      },
      createUser: {
        description: 'Create a new user',
        resolverOf: 'plugins::users-permissions.user.create',
        resolver: async (obj, options, { context }) => {
          context.params = _.toPlainObject(options.input.where);
          context.request.body = _.toPlainObject(options.input.data);

          await strapi.plugins['users-permissions'].controllers.user.create(context);

          return {
            user: context.body.toJSON ? context.body.toJSON() : context.body,
          };
        },
      },
      updateUser: {
        description: 'Update an existing user',
        resolverOf: 'plugins::users-permissions.user.update',
        resolver: async (obj, options, { context }) => {
          context.params = _.toPlainObject(options.input.where);
          context.request.body = _.toPlainObject(options.input.data);

          await strapi.plugins['users-permissions'].controllers.user.update(context);

          return {
            user: context.body.toJSON ? context.body.toJSON() : context.body,
          };
        },
      },
      deleteUser: {
        description: 'Delete an existing user',
        resolverOf: 'plugins::users-permissions.user.destroy',
        resolver: async (obj, options, { context }) => {
          // Set parameters to context.
          context.params = _.toPlainObject(options.input.where);
          context.request.body = _.toPlainObject(options.input.data);

          // Retrieve user to be able to return it because
          // Bookshelf doesn't return the row once deleted.
          await strapi.plugins['users-permissions'].controllers.user.findOne(context);
          // Assign result to user.
          const user = context.body.toJSON ? context.body.toJSON() : context.body;

          // Run destroy query.
          await strapi.plugins['users-permissions'].controllers.user.destroy(context);

          return {
            user,
          };
        },
      },
      register: {
        description: 'Register a user',
        resolverOf: 'plugins::users-permissions.auth.register',
        resolver: async (obj, options, { context }) => {
          context.request.body = _.toPlainObject(options.input);

          await strapi.plugins['users-permissions'].controllers.auth.register(context);
          let output = context.body.toJSON ? context.body.toJSON() : context.body;

          checkBadRequest(output);
          return {
            user: output.user || output,
            jwt: output.jwt,
          };
        },
      },
      login: {
        resolverOf: 'plugins::users-permissions.auth.callback',
        resolver: async (obj, options, { context }) => {
          context.params = {
            ...context.params,
            provider: options.input.provider,
          };
          context.request.body = _.toPlainObject(options.input);

          await strapi.plugins['users-permissions'].controllers.auth.callback(context);
          let output = context.body.toJSON ? context.body.toJSON() : context.body;

          checkBadRequest(output);
          return {
            user: output.user || output,
            jwt: output.jwt,
          };
        },
      },
    },
  },
};

import { Op } from 'sequelize';
import _ from 'underscore';
import database from './../../models';
import { checkRole, checkOwnership, generateJwt } from './auth.controller';
import { handleSequelizeError } from './../../utils/error-handlers.utils';


const {
  User, Role, UserNotification, Notification
} = database;

const allowedFields = [
  'firstname',
  'surname',
  'email',
  'phone',
  'dob',
  'sex',
  'state'
];
/**
 * Create User
 *
 * @export
 * @param {any} data the user data
 *
 * @returns {object} the created User
 */
export async function createUser(data) {
  try {
    const role = await Role.findOne({ where: { name: 'USER' } });
    const permissions = await role.getPermissions();
    const user = await User.create(data, { fields: allowedFields });
    await user.setRoles(role);
    await user.setPermissions(permissions);

    const { uuid } = user;

    const token = await generateJwt({ uuid });

    return token;
  } catch (error) {
    throw error;
  }
}

/**
 * Creates a user
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @returns {object} the response
 */
export async function registerUser(req, res) {
  try {
    const token = await createUser(req.body);
    return res.status(201).json({ status: 'success', data: { token } });
  } catch (error) {
    return handleSequelizeError(error, res);
  }
}

/**
 * Update a user's info
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function updateUser(req, res) {
  try {
    const {
      role, user, decoded: { uuid: userUuid }, params: { uuid }
    } = req;
    const isOwner = checkOwnership(uuid, userUuid);
    const isSuperUser = checkRole(['ADMIN', 'SUPER_USER'], role);
    const canUpdate = isOwner || isSuperUser;

    if (!canUpdate) {
      throw new Error('un-authorized access');
    }

    if (isOwner) {
      await user.update(req.body, { fields: ['firstname', 'surname', 'age'] });
    } else if (isSuperUser) {
      await User
        .update(req.body, {
          where: { uuid },
          attributes: { exclude: ['id', 'createdAt', 'updatedAt'] }
        }, { fields: allowedFields });
    }
    return res.status(200).json({ status: 'success', message: 'User updated!' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * Get a user's info
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function getUser(req, res) {
  try {
    const {
      role, user, decoded: { uuid: userUuid }, params: { uuid }
    } = req;
    const isOwner = checkOwnership(uuid, userUuid);
    const isSuperUser = checkRole(['ADMIN', 'SUPER_USER'], role);
    const canFetch = isOwner || isSuperUser;

    if (!canFetch) {
      throw new Error('un-authorized access');
    }

    const data = isOwner ? user : await User
      .findOne({
        where: { uuid: req.params.uuid },
        attributes: { exclude: ['id', 'createdAt', 'updatedAt'] }
      });

    if (data) {
      return res.status(200).json({ status: 'success', data });
    }

    return res.status(404).json({ status: 'fail', message: 'user not found' });
  } catch (error) {
    return handleSequelizeError(error, res);
  }
}

/**
 * Get a user's info
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function getUsers(req, res) {
  try {
    const { role } = req;
    const isSuperUser = checkRole(['ADMIN', 'SUPER_USER'], role);

    if (!isSuperUser) {
      throw new Error('un-authorized access');
    }

    const limit = req.query.limit || 10;
    const offset = req.query.offset || 0;
    const data = await User.findAndCount({
      limit,
      offset,
      attributes: { exclude: ['id', 'password', 'createdAt', 'updatedAt'] }
    });

    if (data.rows.length > 0) {
      const pages = +(data.count / limit).toFixed();
      data.totalPages = pages === 0 ? 1 : pages;
      data.currentPage = (offset === 0 ? 1 : offset / limit).toFixed();
      return res.status(200).json({ status: 'success', data });
    }

    return res.status(404).json({ status: 'fail', message: 'no user found' });
  } catch (error) {
    return handleSequelizeError(error, res);
  }
}

/**
 * add a user's Notifications
 *
 * @export
 * @param {object} user the request object
 * @param {object} userNotifications the request object
 *
 * @return {object} the response
 */
async function generateNotification(user, userNotifications) {
  return userNotifications;
}

/**
 * add a user's Notifications
 *
 * @export
 *
 * @return {object} the response
 */
export async function addUserNotifications() {
  try {
    const users = await User.findAll();
    users.forEach((user) => {
      user.getNotifications()
        .then((notifications) => {
          if (notifications) {
            generateNotification(user, notifications).then((messages) => {
              user.setNotifications(messages);
            });
          }
        });
    });
  } catch (error) {
    throw error;
  }
}


/**
 * get a user's Notifications
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function getUserNotifications(req, res) {
  try {
    const {
      role, user, decoded: { uuid: userUuid },
    } = req;
    const isOwner = checkOwnership(user.uuid, userUuid);
    const isSuperUser = checkRole(['ADMIN', 'SUPER_USER'], role);
    const canGetNotification = isOwner || isSuperUser;

    if (!canGetNotification) {
      throw new Error('un-authorized access');
    }
    const data = await user.getNotifications();
    if (data) {
      return res.status(200).json({ status: 'success', data });
    }
    return res.status(404).json({ status: 'fail', message: 'no notifications found' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * update a user's Notifications
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function updateUserNotifications(req, res) {
  try {
    const {
      role, user, decoded: { uuid: userUuid }
    } = req;

    const { code } = req.params;
    const isOwner = checkOwnership(user.uuid, userUuid);
    const isSuperUser = checkRole(['ADMIN', 'SUPER_USER'], role);
    const canGetNotification = isOwner || isSuperUser;

    if (!canGetNotification) {
      throw new Error('un-authorized access');
    }
    const { id } = await Notification.findOne({ where: { code } });
    if (id) {
      await UserNotification
        .update({ read: true }, {
          where: { NotificationId: id }
        });
      return res.status(200).json({ status: 'success' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * Reset a users password
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function resetUserPassword(req, res) {}

/**
 * Update a users email
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function updateUserEmail(req, res) {}

/**
 * Update a users phone
 *
 * @export
 * @param {object} req the request object
 * @param {object} res the response obbject
 *
 * @return {object} the response
 */
export async function updateUserPhone(req, res) {}

// @flow

import bots from 'lib/facts/bots.json';
import { threadTypes } from 'lib/types/thread-types';

import { getRolePermissionBlobsForChat } from '../creators/role-creator';
import { dbQuery, SQL } from '../database/database';
import { createScriptViewer } from '../session/scripts';
import {
  commitMembershipChangeset,
  recalculateAllPermissions,
} from '../updaters/thread-permission-updaters';
import { main } from './utils';

async function markThreadsAsPrivate() {
  const findThreadsToUpdate = SQL`
    SELECT t.id, r.id AS role
    FROM (
      SELECT t.id
      FROM threads t
      INNER JOIN memberships m
        ON m.thread = t.id
      WHERE t.type = ${threadTypes.CHAT_SECRET}
      GROUP BY id
      HAVING
        COUNT(m.thread) = 1
    ) t
    INNER JOIN roles r ON r.thread = t.id
  `;
  const [result] = await dbQuery(findThreadsToUpdate);
  const threadIDs = result.map((row) => row.id);

  if (threadIDs.length === 0) {
    return;
  }

  const description =
    'This is your private thread, ' +
    'where you can set reminders and jot notes in private!';

  const updateThreads = SQL`
    UPDATE threads
    SET type = ${threadTypes.PRIVATE}, description = ${description}
    WHERE id IN (${threadIDs})
  `;

  const defaultRolePermissions = getRolePermissionBlobsForChat(
    threadTypes.PRIVATE,
  ).Members;
  const defaultRolePermissionString = JSON.stringify(defaultRolePermissions);
  const viewer = createScriptViewer(bots.squadbot.userID);
  const permissionPromises = result.map(async ({ id, role }) => {
    console.log(`Updating thread ${id} and role ${role}`);
    const updatePermissions = SQL`
      UPDATE roles
      SET permissions = ${defaultRolePermissionString}
      WHERE id = ${role}
    `;
    await dbQuery(updatePermissions);

    const changeset = await recalculateAllPermissions(
      id.toString(),
      threadTypes.PRIVATE,
    );
    return await commitMembershipChangeset(viewer, changeset);
  });

  await Promise.all([dbQuery(updateThreads), ...permissionPromises]);
}

main([markThreadsAsPrivate]);

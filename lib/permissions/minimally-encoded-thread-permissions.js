// @flow

import invariant from 'invariant';
import t, { type TInterface } from 'tcomb';

import { parseThreadPermissionString } from './prefixes.js';
import type {
  ThreadPermission,
  ThreadPermissionsInfo,
  ThreadRolePermissionsBlob,
} from '../types/thread-permission-types.js';
import type {
  MemberInfo,
  RoleInfo,
  ThreadCurrentUserInfo,
} from '../types/thread-types.js';
import {
  memberInfoValidator,
  roleInfoValidator,
  threadCurrentUserInfoValidator,
} from '../types/thread-types.js';
import { entries, invertObjectToMap } from '../utils/objects.js';
import { tRegex, tShape } from '../utils/validation-utils.js';
import type { TRegex } from '../utils/validation-utils.js';

// `baseRolePermissionEncoding` maps permission names to indices.
// These indices represent the 6-bit basePermission part of the 10-bit role
// permission encoding created by `rolePermissionToBitmaskHex`.
// The 6-bit basePermission allows for up to 2^6 = 64 different permissions.
// If more than 64 permissions are needed, the encoding in
// `rolePermissionToBitmaskHex` will need to be updated to accommodate this.
const baseRolePermissionEncoding = Object.freeze({
  // TODO (atul): Update flow to `194.0.0` for bigint support
  // $FlowIssue bigint-unsupported
  know_of: BigInt(0),
  visible: BigInt(1),
  voiced: BigInt(2),
  edit_entries: BigInt(3),
  edit_thread: BigInt(4), // EDIT_THREAD_NAME
  edit_thread_description: BigInt(5),
  edit_thread_color: BigInt(6),
  delete_thread: BigInt(7),
  create_subthreads: BigInt(8), // CREATE_SUBCHANNELS
  create_sidebars: BigInt(9),
  join_thread: BigInt(10),
  edit_permissions: BigInt(11),
  add_members: BigInt(12),
  remove_members: BigInt(13),
  change_role: BigInt(14),
  leave_thread: BigInt(15),
  react_to_message: BigInt(16),
  edit_message: BigInt(17),
  edit_thread_avatar: BigInt(18),
  manage_pins: BigInt(19),
  manage_invite_links: BigInt(20),
});

// `minimallyEncodedThreadPermissions` is used to map each permission
// to its respective bitmask where the index from `baseRolePermissionEncoding`
// is used to set a specific bit in the bitmask. This is used in the
// `permissionsToBitmaskHex` function where each permission is represented as a
// single bit and the final bitmask is the union of all granted permissions.
const minimallyEncodedThreadPermissions = Object.fromEntries(
  Object.keys(baseRolePermissionEncoding).map((key, idx) => [
    key,
    BigInt(1) << BigInt(idx),
  ]),
);

// This function converts a set of permissions to a hex-encoded bitmask.
// Each permission is represented as a single bit in the bitmask.
const permissionsToBitmaskHex = (
  permissions: ThreadPermissionsInfo,
): string => {
  let bitmask = BigInt(0);
  for (const [key, permission] of entries(permissions)) {
    if (permission.value && key in minimallyEncodedThreadPermissions) {
      invariant(
        // TODO (atul): Update flow to `194.0.0` for bigint support
        // $FlowIssue illegal-typeof
        typeof minimallyEncodedThreadPermissions[key] === 'bigint',
        'must be bigint',
      );
      bitmask |= minimallyEncodedThreadPermissions[key];
    }
  }
  return bitmask.toString(16);
};

const hasPermission = (
  permissionsBitmaskHex: string,
  permission: ThreadPermission,
): boolean => {
  const permissionsBitmask = BigInt(`0x${permissionsBitmaskHex}`);
  if (!(permission in minimallyEncodedThreadPermissions)) {
    return false;
  }
  const permissionBitmask = minimallyEncodedThreadPermissions[permission];
  invariant(
    // TODO (atul): Update flow to `194.0.0` for bigint support
    // $FlowIssue illegal-typeof
    typeof permissionBitmask === 'bigint',
    'permissionBitmask must be of type bigint',
  );
  return (permissionsBitmask & permissionBitmask) !== BigInt(0);
};

const propagationPrefixes = Object.freeze({
  '': BigInt(0),
  'descendant_': BigInt(1),
  'child_': BigInt(2),
});
const filterPrefixes = Object.freeze({
  '': BigInt(0),
  'open_': BigInt(1),
  'toplevel_': BigInt(2),
  'opentoplevel_': BigInt(3),
});

// Role Permission Bitmask Structure
// [9 8 7 6 5 4 3 2 1 0] - bit positions
// [b b b b b b p p f f] - symbol representation
// b = basePermission    (6 bits)
// p = propagationPrefix (2 bits)
// f = filterPrefix      (2 bits)
const rolePermissionToBitmaskHex = (threadRolePermission: string): string => {
  const parsed = parseThreadPermissionString(threadRolePermission);
  const basePermissionBits =
    baseRolePermissionEncoding[parsed.permission] & BigInt(63);
  const propagationPrefixBits =
    propagationPrefixes[parsed.propagationPrefix ?? ''] & BigInt(3);
  const filterPrefixBits =
    filterPrefixes[parsed.filterPrefix ?? ''] & BigInt(3);

  const bitmask =
    (basePermissionBits << BigInt(4)) |
    (propagationPrefixBits << BigInt(2)) |
    filterPrefixBits;

  return bitmask.toString(16).padStart(3, '0');
};

const inverseBaseRolePermissionEncoding = invertObjectToMap(
  baseRolePermissionEncoding,
);

// $FlowIssue bigint-unsupported
const inversePropagationPrefixes: Map<bigint, string> =
  invertObjectToMap(propagationPrefixes);

// $FlowIssue bigint-unsupported
const inverseFilterPrefixes: Map<bigint, string> =
  invertObjectToMap(filterPrefixes);

const decodeRolePermissionBitmask = (bitmask: string): string => {
  const bitmaskInt = BigInt(`0x${bitmask}`);
  const basePermission = (bitmaskInt >> BigInt(4)) & BigInt(63);
  const propagationPrefix = (bitmaskInt >> BigInt(2)) & BigInt(3);
  const filterPrefix = bitmaskInt & BigInt(3);

  const basePermissionString =
    inverseBaseRolePermissionEncoding.get(basePermission);
  const propagationPrefixString =
    inversePropagationPrefixes.get(propagationPrefix) ?? '';
  const filterPrefixString = inverseFilterPrefixes.get(filterPrefix) ?? '';

  invariant(
    basePermissionString !== null &&
      basePermissionString !== undefined &&
      propagationPrefixString !== null &&
      propagationPrefixString !== undefined &&
      filterPrefixString !== null &&
      filterPrefixString !== undefined,
    'invalid bitmask',
  );

  return `${propagationPrefixString}${filterPrefixString}${basePermissionString}`;
};

const threadRolePermissionsBlobToBitmaskArray = (
  threadRolePermissionsBlob: ThreadRolePermissionsBlob,
): $ReadOnlyArray<string> =>
  Object.keys(threadRolePermissionsBlob).map(rolePermissionToBitmaskHex);

const decodeThreadRolePermissionsBitmaskArray = (
  threadRolePermissionsBitmaskArray: $ReadOnlyArray<string>,
): ThreadRolePermissionsBlob =>
  Object.fromEntries(
    threadRolePermissionsBitmaskArray.map(bitmask => [
      decodeRolePermissionBitmask(bitmask),
      true,
    ]),
  );

export type MinimallyEncodedRoleInfo = {
  ...RoleInfo,
  +permissions: $ReadOnlyArray<string>,
};

const tHexEncodedRolePermission: TRegex = tRegex(/^[0-9a-fA-F]{3,}$/);
const minimallyEncodedRoleInfoValidator: TInterface<MinimallyEncodedRoleInfo> =
  tShape<MinimallyEncodedRoleInfo>({
    ...roleInfoValidator.meta.props,
    permissions: t.list(tHexEncodedRolePermission),
  });

export type MinimallyEncodedThreadCurrentUserInfo = {
  ...ThreadCurrentUserInfo,
  +permissions: string,
};

const tHexEncodedPermissionsBitmask: TRegex = tRegex(/^[0-9a-fA-F]+$/);
const minimallyEncodedThreadCurrentUserInfoValidator: TInterface<MinimallyEncodedThreadCurrentUserInfo> =
  tShape<MinimallyEncodedThreadCurrentUserInfo>({
    ...threadCurrentUserInfoValidator.meta.props,
    permissions: tHexEncodedPermissionsBitmask,
  });

export type MinimallyEncodedMemberInfo = {
  ...MemberInfo,
  +permissions: string,
};

const minimallyEncodedMemberInfoValidator: TInterface<MinimallyEncodedMemberInfo> =
  tShape<MinimallyEncodedMemberInfo>({
    ...memberInfoValidator.meta.props,
    permissions: tHexEncodedPermissionsBitmask,
  });

export {
  permissionsToBitmaskHex,
  hasPermission,
  rolePermissionToBitmaskHex,
  decodeRolePermissionBitmask,
  threadRolePermissionsBlobToBitmaskArray,
  decodeThreadRolePermissionsBitmaskArray,
  minimallyEncodedRoleInfoValidator,
  minimallyEncodedThreadCurrentUserInfoValidator,
  minimallyEncodedMemberInfoValidator,
};

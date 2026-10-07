const databaseName = "intelligent_agent";

const businessCollections = [
  "conversations",
  "messages",
  "preconsultation_summaries",
  "idempotency_records",
  "outbox_events"
];

const liquibaseCollections = [
  "databasechangelog_intelligent_agent",
  "databasechangeloglock_intelligent_agent"
];

const readerRoleName = "intelligent_agent_reader";
const writerRoleName = "intelligent_agent_writer";

function getRoleOrFail(roleName) {
  const role = db.getRole(roleName, {
    showPrivileges: true,
    showBuiltinRoles: false
  });

  if (!role) {
    throw new Error(`Missing role: ${roleName}`);
  }

  return role;
}

function privilegeFor(role, collection) {
  return role.privileges.find(
    privilege =>
      privilege.resource.db === databaseName &&
      privilege.resource.collection === collection
  );
}

function assertExactActions(label, actualActions, expectedActions) {
  const actual = [...actualActions].sort();
  const expected = [...expectedActions].sort();

  if (
    actual.length !== expected.length ||
    actual.some((action, index) => action !== expected[index])
  ) {
    throw new Error(
      `${label}: expected [${expected.join(", ")}], got [${actual.join(", ")}]`
    );
  }
}

const reader = getRoleOrFail(readerRoleName);
const writer = getRoleOrFail(writerRoleName);

if (reader.roles.length !== 0) {
  throw new Error(
    `${readerRoleName} must not inherit other roles`
  );
}

for (const collection of businessCollections) {
  const readerPrivilege = privilegeFor(reader, collection);

  if (!readerPrivilege) {
    throw new Error(
      `${readerRoleName} has no privilege for ${collection}`
    );
  }

  assertExactActions(
    `${readerRoleName}.${collection}`,
    readerPrivilege.actions,
    ["find"]
  );
}

const writerInheritedReader = writer.roles.some(
  role =>
    role.role === readerRoleName &&
    role.db === databaseName
);

if (!writerInheritedReader) {
  throw new Error(
    `${writerRoleName} must inherit ${readerRoleName}`
  );
}

if (writer.roles.length !== 1) {
  throw new Error(
    `${writerRoleName} must inherit only ${readerRoleName}`
  );
}

const expectedWriterActions = [
  "insert",
  "remove",
  "update"
];

for (const collection of businessCollections) {
  const writerPrivilege = privilegeFor(writer, collection);

  if (!writerPrivilege) {
    throw new Error(
      `${writerRoleName} has no write privilege for ${collection}`
    );
  }

  assertExactActions(
    `${writerRoleName}.${collection}`,
    writerPrivilege.actions,
    expectedWriterActions
  );
}

const forbiddenActions = [
  "createCollection",
  "dropCollection",
  "createIndex",
  "dropIndex",
  "createUser",
  "dropUser",
  "createRole",
  "dropRole"
];

for (const role of [reader, writer]) {
  for (const privilege of role.privileges) {
    if (privilege.resource.db !== databaseName) {
      throw new Error(
        `${role.role} has privilege outside ${databaseName}`
      );
    }

    const collection = privilege.resource.collection;

    if (
      collection === "" ||
      collection === undefined ||
      collection === null
    ) {
      throw new Error(
        `${role.role} must not have database-wide collection privileges`
      );
    }

    if (liquibaseCollections.includes(collection)) {
      throw new Error(
        `${role.role} must not access Liquibase control collection ${collection}`
      );
    }

    if (!businessCollections.includes(collection)) {
      throw new Error(
        `${role.role} has privilege on unexpected collection ${collection}`
      );
    }

    for (const action of forbiddenActions) {
      if (privilege.actions.includes(action)) {
        throw new Error(
          `${role.role} must not have administrative action ${action}`
        );
      }
    }
  }
}

if (reader.privileges.length !== businessCollections.length) {
  throw new Error(
    `${readerRoleName} must define exactly ${businessCollections.length} collection privileges`
  );
}

if (writer.privileges.length !== businessCollections.length) {
  throw new Error(
    `${writerRoleName} must define exactly ${businessCollections.length} direct collection privileges`
  );
}

print("Intelligent Agent database role tests passed.");
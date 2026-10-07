const databaseName = "intelligent_agent";
const businessCollections = [
  "conversations",
  "messages",
  "preconsultation_summaries",
  "idempotency_records",
  "outbox_events"
];

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

const reader = getRoleOrFail("intelligent_agent_reader");
const writer = getRoleOrFail("intelligent_agent_writer");

for (const collection of businessCollections) {
  const readerPrivilege = privilegeFor(reader, collection);

  if (!readerPrivilege) {
    throw new Error(
      `Reader role has no privilege for ${collection}`
    );
  }

  if (
    readerPrivilege.actions.length !== 1 ||
    !readerPrivilege.actions.includes("find")
  ) {
    throw new Error(
      `Reader role must only have find on ${collection}`
    );
  }
}

const writerInheritedReader = writer.roles.some(
  role =>
    role.role === "intelligent_agent_reader" &&
    role.db === databaseName
);

if (!writerInheritedReader) {
  throw new Error(
    "Writer role must inherit intelligent_agent_reader"
  );
}

const expectedWriterActions = ["insert", "remove", "update"];

for (const collection of businessCollections) {
  const writerPrivilege = privilegeFor(writer, collection);

  if (!writerPrivilege) {
    throw new Error(
      `Writer role has no write privilege for ${collection}`
    );
  }

  for (const action of expectedWriterActions) {
    if (!writerPrivilege.actions.includes(action)) {
      throw new Error(
        `Writer role is missing ${action} on ${collection}`
      );
    }
  }
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

    if (
      privilege.resource.collection &&
      !businessCollections.includes(
        privilege.resource.collection
      )
    ) {
      throw new Error(
        `${role.role} has privilege on unexpected collection ${privilege.resource.collection}`
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

print("Intelligent Agent database role tests passed.");

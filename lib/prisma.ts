import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function hasCurrentModels(client: PrismaClient | undefined): boolean {
  return Boolean(
    client &&
      client.pettyCashEntry &&
      client.projectServiceAreaCatalog &&
      client.projectSubcategoryCatalog &&
      client.bpjsRemittance &&
      client.companyCashMovement &&
      client.taxRateType
  );
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && hasCurrentModels(existing)) {
    return existing;
  }
  if (existing) {
    void existing.$disconnect();
    globalForPrisma.prisma = undefined;
  }
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

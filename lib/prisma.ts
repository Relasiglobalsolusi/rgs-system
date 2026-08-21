import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaStaleRetried?: boolean;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function hasCurrentModels(client: PrismaClient | undefined): client is PrismaClient {
  return Boolean(
    client &&
      client.pettyCashEntry &&
      client.projectServiceAreaCatalog &&
      client.projectSubcategoryCatalog
  );
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (hasCurrentModels(existing)) {
    return existing;
  }
  if (existing && !globalForPrisma.prismaStaleRetried) {
    void (existing as PrismaClient).$disconnect();
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaStaleRetried = true;
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

import { Prisma } from "@prisma/client";

export function isPrismaMissingColumnError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("p2022") || (message.includes("column") && message.includes("does not exist"));
}


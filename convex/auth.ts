import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Auto-promote the very first user to admin
      if (!existingUserId) {
        const allUsers = await ctx.db.query("users").collect();
        if (allUsers.length === 1) {
          await ctx.db.patch(userId, { role: "admin" as const });
        }
      }
    },
  },
});

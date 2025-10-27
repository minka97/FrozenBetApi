import crypto from 'crypto';

export const generateInviteCode = (): string => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

export const generateInvitationToken = (): string => {
  return crypto.randomUUID();
};

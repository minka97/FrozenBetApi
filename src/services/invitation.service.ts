import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateInvitationToken } from '../utils/inviteCode';

export class InvitationService {
  async createInvitation(inviterId: number, data: {
    inviteeEmail: string;
    groupId: number;
  }) {
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
      include: {
        owner: true,
      },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Group not found');
    }

    // Check if inviter is a member with admin or owner role
    const inviterMember = await prisma.groupMember.findFirst({
      where: {
        groupId: data.groupId,
        userId: inviterId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!inviterMember) {
      throw new AppError(403, 'FORBIDDEN', 'Only group admins can send invitations');
    }

    // Check if user already has a pending invitation
    const existingInvitation = await prisma.groupInvitation.findFirst({
      where: {
        groupId: data.groupId,
        inviteeEmail: data.inviteeEmail,
        status: 'pending',
      },
    });

    if (existingInvitation) {
      throw new AppError(409, 'CONFLICT', 'User already has a pending invitation');
    }

    // Generate unique token
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const invitation = await prisma.groupInvitation.create({
      data: {
        groupId: data.groupId,
        inviterId,
        inviteeEmail: data.inviteeEmail,
        token,
        expiresAt,
        status: 'pending',
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return invitation;
  }

  async getReceivedInvitations(userEmail: string) {
    const invitations = await prisma.groupInvitation.findMany({
      where: {
        inviteeEmail: userEmail,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            visibility: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  async getSentInvitations(inviterId: number) {
    const invitations = await prisma.groupInvitation.findMany({
      where: { inviterId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  async acceptInvitation(token: string, userId: number, userEmail: string) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
      include: { group: true },
    });

    if (!invitation) {
      throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
    }

    if (invitation.inviteeEmail !== userEmail) {
      throw new AppError(403, 'FORBIDDEN', 'This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(400, 'BAD_REQUEST', 'Invitation has already been processed');
    }

    if (new Date() > invitation.expiresAt) {
      throw new AppError(400, 'BAD_REQUEST', 'Invitation has expired');
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId: invitation.groupId,
        userId,
      },
    });

    if (existingMember) {
      throw new AppError(409, 'CONFLICT', 'Already a member of this group');
    }

    // Accept invitation and add user to group
    await prisma.$transaction([
      prisma.groupInvitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted' },
      }),
      prisma.groupMember.create({
        data: {
          groupId: invitation.groupId,
          userId,
          role: 'member',
        },
      }),
    ]);

    return {
      message: 'Invitation accepted successfully',
      group: invitation.group,
    };
  }

  async rejectInvitation(token: string, userEmail: string) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
    }

    if (invitation.inviteeEmail !== userEmail) {
      throw new AppError(403, 'FORBIDDEN', 'This invitation is not for you');
    }

    if (invitation.status !== 'pending') {
      throw new AppError(400, 'BAD_REQUEST', 'Invitation has already been processed');
    }

    await prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { status: 'rejected' },
    });

    return { message: 'Invitation rejected successfully' };
  }

  async deleteInvitation(invitationId: number, userId: number) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new AppError(404, 'NOT_FOUND', 'Invitation not found');
    }

    // Check if user is the inviter or has admin rights in the group
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId: invitation.groupId,
        userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (invitation.inviterId !== userId && !member) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }

    await prisma.groupInvitation.delete({
      where: { id: invitationId },
    });

    return { message: 'Invitation deleted successfully' };
  }
}

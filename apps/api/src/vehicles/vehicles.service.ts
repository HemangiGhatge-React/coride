import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, data: { make: string; model: string; plate: string; seats: number }) {
    return this.prisma.vehicle.create({
      data: {
        ownerId,
        make: data.make,
        model: data.model,
        plate: data.plate,
        seats: data.seats,
      },
    });
  }

  async findMine(ownerId: string) {
    return this.prisma.vehicle.findMany({ where: { ownerId } });
  }

  async findOneOwnedBy(vehicleId: string, ownerId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.ownerId !== ownerId) throw new ForbiddenException('You do not own this vehicle');
    return vehicle;
  }
}
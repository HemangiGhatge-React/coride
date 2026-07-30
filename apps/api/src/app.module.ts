import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { RidesModule } from './rides/rides.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BookingsModule } from './bookings/bookings.module';


@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, UsersModule, PrismaModule, RidesModule, VehiclesModule, BookingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

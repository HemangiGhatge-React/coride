import { VehiclesService } from './vehicles.service';
declare class CreateVehicleDto {
    make: string;
    model: string;
    plate: string;
    seats: number;
}
export declare class VehiclesController {
    private vehiclesService;
    constructor(vehiclesService: VehiclesService);
    create(req: any, body: CreateVehicleDto): Promise<{
        id: string;
        make: string;
        model: string;
        plate: string;
        seats: number;
        ownerId: string;
    }>;
    findMine(req: any): Promise<{
        id: string;
        make: string;
        model: string;
        plate: string;
        seats: number;
        ownerId: string;
    }[]>;
}
export {};

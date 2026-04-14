import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { AppException } from '@app/common';

@Controller('users')
export class UsersController {

    constructor(private readonly usersService: UsersService) {}

   @Get('')
    findAll() {
        return this.usersService.findAll();
    }
}

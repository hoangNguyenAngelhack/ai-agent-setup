import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto) {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }
    return this.usersRepository.create(dto);
  }

  async findAll(page = 1, limit = 10) {
    return this.usersRepository.findAll(page, limit);
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    return this.usersRepository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.usersRepository.delete(id);
  }
}

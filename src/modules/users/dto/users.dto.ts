import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}


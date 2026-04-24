import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}


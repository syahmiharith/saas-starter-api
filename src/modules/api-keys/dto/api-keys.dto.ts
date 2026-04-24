import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { API_KEY_SCOPES, ApiKeyScope } from '../../common/constants/api-key-scopes';

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ enum: API_KEY_SCOPES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes?: ApiKeyScope[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}


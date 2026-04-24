import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ enum: ['pro', 'team', 'enterprise'] })
  @IsString()
  @IsIn(['pro', 'team', 'enterprise'])
  plan: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}

export class CreatePortalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;
}


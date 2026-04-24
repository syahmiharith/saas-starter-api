import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['admin', 'member', 'viewer'] })
  @IsString()
  @IsIn(['admin', 'member', 'viewer'])
  role: string;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  token: string;
}


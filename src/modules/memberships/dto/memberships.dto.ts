import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['owner', 'admin', 'member', 'viewer'] })
  @IsString()
  @IsIn(['owner', 'admin', 'member', 'viewer'])
  role: string;
}


import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/request.types';
import {
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterDto,
  RequestEmailVerificationDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto
} from './dto/auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, request);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, request);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, request);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Body() dto: LogoutDto, @CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.auth.logout(user.id, dto.refreshToken, request);
  }

  @Post('email/verify/request')
  requestEmailVerification(@Body() dto: RequestEmailVerificationDto) {
    return this.auth.requestEmailVerification(dto.email);
  }

  @Post('email/verify')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('password/reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.auth.resetPassword(dto.token, dto.password, request);
  }
}


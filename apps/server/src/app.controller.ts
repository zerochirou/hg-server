import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

@Controller()
export class AppController {
  @Get()
  root(@Res() res: Response) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return res.redirect(`${clientUrl}/dashboard`);
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'hypergrid-server',
      timestamp: new Date().toISOString(),
    };
  }
}

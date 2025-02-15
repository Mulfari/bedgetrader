import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

@Controller('proxy-test')
export class ProxyTestController {
  private proxyUrl = 'http://spj4f84ugp:cquYV74a4kWrct_V9h@de.smartproxy.com:20001';

  @Get('/internet')
  async testInternet() {
    try {
      const proxyAgent = new HttpsProxyAgent(this.proxyUrl);

      // 🔹 Prueba de conexión a Internet
      const response = await axios.get('https://ipinfo.io/json', { httpsAgent: proxyAgent });
      return { success: true, data: response.data };
    } catch (error) {
      throw new HttpException(
        `❌ Error en Proxy - Internet: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/bybit')
  async testBybit() {
    try {
      const proxyAgent = new HttpsProxyAgent(this.proxyUrl);

      // 🔹 Prueba de conexión a Bybit
      const response = await axios.get('https://api.bybit.com/v5/market/time', { httpsAgent: proxyAgent });
      return { success: true, data: response.data };
    } catch (error) {
      throw new HttpException(
        `❌ Error en Proxy - Bybit: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

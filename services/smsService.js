const axios = require('axios');

class SMSService {
  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY || 'LlXzPbZUoK37w3rkoiU0zbaspTTHSAcmoI82vjPKz7DpF5VUGkXavOgCEMRs';
    this.baseURL = 'https://www.fast2sms.com/dev/bulkV2';
  }

  async sendOTP(phoneNumber, otp) {
    try {
      const response = await axios.post(this.baseURL, {
        route: 'otp',
        variables_values: otp,
        numbers: phoneNumber.replace('+91', ''), // Remove country code if present
      }, {
        headers: {
          'authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.return === true) {
        return {
          success: true,
          message: 'OTP sent successfully',
          data: response.data
        };
      } else {
        throw new Error(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('SMS Service Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to send OTP',
        error: error.response?.data || error.message
      };
    }
  }

  async sendCustomMessage(phoneNumber, message) {
    try {
      const response = await axios.post(this.baseURL, {
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: phoneNumber.replace('+91', '')
      }, {
        headers: {
          'authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: response.data.return === true,
        message: response.data.message,
        data: response.data
      };
    } catch (error) {
      console.error('SMS Service Error:', error.response?.data || error.message);
      return {
        success: false,
        message: 'Failed to send message',
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = new SMSService();
import { useState } from 'react'
import { Button, Form, Input, Select } from 'antd'

export default function ProfileEdit({lang = "en"}) {

  const [form] = Form.useForm()

  const onFinish = (values) => {
    // TODO: Add API call to save profile data
    console.log('Profile data:', values)
  }

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px' }}>
      <h2>Edit Profile</h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
      >
        <Form.Item
          name="firstName"
          label="First Name"
          rules={[{ required: true, message: 'Please input your first name!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="lastName" 
          label="Last Name"
          rules={[{ required: true, message: 'Please input your last name!' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="country"
          label="Country"
          rules={[{ required: true, message: 'Please select your country!' }]}
        >
          <Select
            showSearch
            placeholder="Select your country"
            options={[
              { value: 'USA', label: 'United States' },
              { value: 'UK', label: 'United Kingdom' },
              { value: 'CA', label: 'Canada' },
              // Add more countries as needed
            ]}
          />
        </Form.Item>

        <Form.Item
          name="religion"
          label="Religion"
        >
          <Select
            showSearch
            placeholder="Select your religion (optional)"
            options={[
              { value: 'christianity', label: 'Christianity' },
              { value: 'islam', label: 'Islam' },
              { value: 'hinduism', label: 'Hinduism' },
              { value: 'buddhism', label: 'Buddhism' },
              { value: 'judaism', label: 'Judaism' },
              { value: 'other', label: 'Other' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Save Profile
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}


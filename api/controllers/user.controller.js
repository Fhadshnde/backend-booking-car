import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, city, country, dateOfBirth } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, address, city, country, dateOfBirth },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-password");

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user"
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, phone, role, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, role, isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user"
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user"
    });
  }
};
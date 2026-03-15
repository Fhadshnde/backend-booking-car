import mongoose from 'mongoose';

const commissionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
    },
    percentage: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
      max: 100,
      description: 'نسبة العمولة من كل حجز (بالنسبة المئوية)',
    },
    fixedAmount: {
      type: Number,
      default: 0,
      min: 0,
      description: 'مبلغ ثابت للعمولة (بالإضافة للنسبة المئوية)',
    },
    isActive: {
      type: Boolean,
      default: true,
      description: 'هل العمولة مفعلة أم لا',
    },
    notes: {
      type: String,
      description: 'ملاحظات حول العمولة',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'الادمن الذي قام بآخر تعديل',
    },
  },
  {
    timestamps: true,
  }
);

const Commission = mongoose.model('Commission', commissionSchema);

export default Commission;

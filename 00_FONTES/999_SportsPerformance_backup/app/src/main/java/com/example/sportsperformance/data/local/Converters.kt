package com.example.sportsperformance.data.local

import androidx.room.TypeConverter
import java.util.Date

class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @TypeConverter
    fun dateToTimestamp(date: Date?): Long? {
        return date?.time
    }

    @TypeConverter
    fun fromDoubleList(value: String?): List<Double>? {
        return value?.split(",")?.mapNotNull { it.toDoubleOrNull() }
    }

    @TypeConverter
    fun toDoubleList(list: List<Double>?): String? {
        return list?.joinToString(",")
    }

    @TypeConverter
    fun fromIntList(value: String?): List<Int>? {
        return value?.split(",")?.mapNotNull { it.toIntOrNull() }
    }

    @TypeConverter
    fun toIntList(list: List<Int>?): String? {
        return list?.joinToString(",")
    }

    @TypeConverter
    fun fromStringList(value: String?): List<String>? {
        return value?.split("||")?.filter { it.isNotBlank() }
    }

    @TypeConverter
    fun toStringList(list: List<String>?): String? {
        return list?.joinToString("||")
    }
}

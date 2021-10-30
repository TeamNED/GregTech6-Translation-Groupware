#ifndef DICTLANGRESULT_H
#define DICTLANGRESULT_H
#pragma once

#include <string>
#include <unordered_map>

#include "ILangResult.hpp"

using std::string;
using std::unordered_map;

class DictLangResult : public virtual ILangResult {
private:
  const unordered_map<string, string> *_dict = nullptr;

public:
  DictLangResult() = default;
  DictLangResult(const unordered_map<string, string> *dict);
  DictLangResult(const DictLangResult &) = default;
  DictLangResult(DictLangResult &&) = default;
  DictLangResult &operator=(const DictLangResult &) = default;
  DictLangResult &operator=(DictLangResult &&) = default;
  virtual ~DictLangResult() = default;
  virtual const unordered_map<string, string> *result() override;
};
#endif